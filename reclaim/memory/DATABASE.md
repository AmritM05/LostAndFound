# Neon database and data ownership

## Provider and migration mechanism

The desired runtime is Neon PostgreSQL, accessed through `lib/server/db.ts` with parameterized HTTP queries. There is no runtime Supabase client or ORM. `scripts/migrate.mts` executes sorted `db/migrations/*.sql` using the Neon WebSocket Pool, then seeds/upserts configured buildings. Each current migration contains its own transaction. A later migration failure does not undo earlier committed files. There is no migration-version table or automatic rollback. Re-running old files also re-creates functions/views/triggers: final ordering matters.

| Migration | Actual changes |
| --- | --- |
| `001_student_backend.sql` | Core relational tables, safe public-found view, atomic `save_student_report` |
| `002_report_deletion.sql` | `has_active_recovery`, `blob_cleanup_jobs`, `delete_own_lost_report` |
| `003_admin_portal.sql` | Admin sessions/throttling/activity, zone coordinates, image role guard, pickup display code, claim uniqueness, matching and recovery functions |

Archived `supabase/schema.sql`, its migrations and seed are not alternative Neon deployment scripts. Their RLS/auth/storage models differ. Do not apply them to the active database.

## Actual tables

| Table | Important columns and relationships | Ownership / deletion behavior |
| --- | --- | --- |
| `users` | UUID `id`, unique lowercase `email`, `display_name`, checked `role`, `created_at` | Default student; shared identity record does not imply shared session authority |
| `demo_sessions` | PK `token_hash`, FK `user_id`, `expires_at`, `created_at` | Random student tokens hashed; user deletion cascades sessions |
| `admin_sessions` | PK `token_hash`, FK `user_id`, `expires_at`, `created_at` | Separate staff tokens; query also requires user's admin role; user deletion cascades |
| `admin_login_attempts` | PK `key_hash`, `attempts`, `window_start` | Persistent attempt counter used after credential comparison; not an account table |
| `buildings` | text `id`, `campus_id`, `name`, `aliases[]`, `latitude`, `longitude`, `active` | Actual campus buildings, not approved intake desks |
| `dropoff_zones` | UUID `id`, optional FK `building_id`, `name`, `instructions`, `active`, coordinates, timestamps | Staff-managed locations; inactive by initial database default |
| `reports` | UUID `id`; FK `reporter_id`; checked `report_type`; `category`, `item_name`, `brand`, `model`, `primary_color`, `secondary_color`, `size`, `description`; `location_known`, FK `building_id`, coordinates, `location_label`; `lost_date`, `lost_time`, `occurred_at`; `status`, FK `dropoff_zone_id`, `custody_status`, `found_at`, `received_at`, `staff_notes`; creation/update times | One table for lost and found. Lost reporter is student; found reporter is staff, not a separately recorded finder |
| `private_report_details` | PK/FK `report_id`; `owner_description`, `serial_fragment`, `stickers`, `scratches`, `contents`, `unique_markings` | Report deletion cascades. Current forms save owner_description; structured fields are largely unused |
| `report_images` | UUID `id`; FK `owner_id`, optional FK `report_id`; filename, `mime_type`, `byte_size`; unique original/preview pathnames and URLs; `status` pending/uploaded; `upload_role` student/admin | Report deletion cascades metadata, not Blob bytes. Trigger validates report/owner/upload-role binding |
| `potential_matches` | UUID `id`; FKs `lost_report_id`, `found_report_id`; `score`, JSONB `factors`, `distance_km`, `minutes_difference`, `dismissed`, `created_at`; unique lost/found pair | Private match rows; related claims/updates require explicit cleanup |
| `claims` | UUID `id`; FK `match_id`, FK `claimant_id`; `answers`, `status`, timestamps; unique `(match_id,claimant_id)` | Owner-only submission. Active claims constrain edits/deletion; status is text, not a DB enum |
| `pickups` | UUID `id`; unique FK `claim_id`; FK `zone_id`; unique `code_hash`, optional `token_hash`; private `display_code`; `expires_at`, `used_at`, `created_at` | Single-use redemption; legacy token_hash column is not the current issued credential |
| `updates` | UUID `id`; FK `user_id`, optional FKs `report_id`, `match_id`; `title`, `message`, `read`, `created_at` | Private student notices, not public messages; generally explicitly deleted/unlinked during report deletion |
| `report_notes` | UUID `id`; FKs `report_id`, `sender_id`; `body`, `from_staff`, `created_at` | Private report correspondence. Student write route enforces owned lost report; claim review can insert staff replies |
| `blob_cleanup_jobs` | UUID `id`; non-FK `report_id`; FK `user_id`; unique `blob_pathname`; `attempts`, `last_error`, timestamps and `completed_at` | Deliberately survives report deletion; user deletion can be constrained by retained jobs |
| `staff_activity` | UUID `id`; FK `staff_id`, optional FK `report_id`; `action`, `created_at` | Report FK sets null on deletion; basic event log, not a complete immutable audit trail |

All tables above exist in desired migrations. No `items`, `item_images`, `matches`, `pickup_records` or `magpie_updates` duplicate tables are needed; those words sometimes appear as TypeScript/UI concepts.

## View and functions

`public_found_summaries` exposes exactly `id,type,category,location,date,status`, deriving broad location from the intake building. It excludes Returned/Archived found reports and those without a zone. It does not expose exact found coordinates, item names or photos. The API limits results to 200; filters are client-side.

- `save_student_report(user,itemJSON,privateText,imageUUIDs,edit)` locks/validates owned images, buildings and report ownership; ignores client reporter/status authority; creates a lost report with initial notice or edits an eligible report. Repeated creation with the same owned ID returns early. Image replacement is not part of editing.
- `has_active_recovery(report)` checks report status, related active claims and unused unexpired/null-expiry pickups; the workspace projection and delete function share it.
- `delete_own_lost_report(user,report)` locks owned lost report and relationships, blocks active recovery, queues original/preview paths, removes related notices/notes/matches/inactive claims/pickups and cascaded private metadata. It preserves unrelated records and clears stale notice match references.
- `validate_image_report_role` enforces image owner/report owner and lost→student / found→admin binding.
- `match_text` and `refresh_report_matches` implement the current heuristic trigger; details and shortcomings are in AI_MATCHING.
- `save_found_report(staff,itemJSON,privateText,imageUUIDs)` requires admin user, active zone, valid chronology/location and completed owned photos, saves private detail and intake activity atomically.
- `submit_ownership_claim(user,match,answer)` locks lost/found reports and match, verifies ownership/availability, inserts Pending or updates a More information claim, updates recovery/custody state and adds an owner notice.
- `review_ownership_claim` locks report/claim rows; permits Approved/Rejected/More information for pending/information claims; prevents duplicate active assignment; issues a seven-day pickup record on approval; writes private notices/optional staff note/activity. `has_active_recovery_claims` helps reset rejected recovery state.
- `redeem_pickup(staff,codeHash)` locks reports/claim/pickup, validates a current unused approved pass, marks used and both reports Returned, and creates owner notice/staff activity.

Foreign-key insert/delete ordering and lock order are part of the contract. Keep race tests when changing these functions. Authorization is primarily server session plus parameterized functions, not Supabase RLS; an exposed privileged database credential would defeat that boundary.

## Gaps and proposals, not existing schema

There are no embeddings, vector index, normalized contradiction provenance, match version, score calibration record, tenant isolation, migration ledger, dedicated custody-history table or retention schedule. Finder metadata is not separately captured. Reports/custody/claims use broad text statuses rather than a universally enforced state machine. Expired approved pickups have no reissue transaction/UI. Campus switching can leave old buildings active because seed conflict updates do not delete/deactivate missing buildings or update campus_id.

Any proposed columns/tables must be reviewed and assigned a new migration with upgrade/backfill/rollback implications. Reuse existing reports/images/matches/updates rather than duplicating domain concepts. See [backlog](TASK_BACKLOG.md) and [coordination](TEAM_COORDINATION.md).
