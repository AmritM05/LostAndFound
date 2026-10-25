# Feature inventory

Status vocabulary is defined in [README](README.md). Verification keys: **N** active Neon/PGlite or API/helper tests rerun in this documentation task; **H** historical implementation-session live/browser evidence (see VERIFICATION); **I** source inspection only. H is not fresh deployed verification. Every row states purpose, route/source, dependency, limitation and remaining work; current implementation is not inferred from a button alone.

## Student and shared product features

| Feature / purpose | Status and route | Sources and dependencies | Verification / limitations / remaining work |
| --- | --- | --- | --- |
| Separate student email login; persistent identity/session | Implemented and verified; `/login`, `/signup`, `/api/session/` | AuthForm, sessionService, server/session, Neon users/demo_sessions | N/H. Optional name; ordinary email accepted; insecure identity by design. Domain allowlist helper is bypassed by this login. Production verification remains planned |
| Student shell, overview, counts and navigation | Implemented and verified; `/`, `/student/overview` | Portal, useWorkspace, owner workspace API | N/H for data projection, H for UI. Not a server-protected page shell; private API is protected. Legacy admin branches are not the active staff UI |
| Category-specific lost report wizard | Implemented and verified; `/student/report`, POST reports | ReportForm, reportFields, validation, save_student_report, session/schema | N/H. Ten categories; attributes/private description/owner evidence; no student found endpoint. No draft recovery after leaving page |
| Optional building/map/unknown location and past time | Implemented and verified; report create/edit | BuildingSelector, CampusMap, campus, server validation, DB buildings | N/H for persistence; Maps service environment-dependent. Building location resolves server-side; unknown clears all coordinates |
| Own report list, details, private photos | Implemented and verified; `/student/reports`, workspace/photo APIs | Portal, PrivatePhoto, repository, Blob/session | N/H. No unrelated report details. Owner email identity is still unverified |
| Edit own lost attributes/description/location | Implemented and verified in database tests; browser edit not freshly retested | EditLostReport, PATCH reports/[id], save_student_report | N; active claims block. Cannot replace/add/delete existing images through edit. Expand only with image lifecycle contract |
| Eligible lost report deletion and confirmation | Implemented and verified; DELETE reports/[id] | DeleteReportAction, repository, migration 002, cleanup outbox | N/H. Two-step UI, cancel focus, 409 active recovery, owner/lost-only; failed Blob cleanup stays queued. No staff found-delete UI |
| Anonymous privacy-safe found search and filters | Implemented and verified; `/student/search`, GET search | Portal, public_found_summaries, repository.search | N/H for six-field privacy. Query/type/category/date/location filtering in browser, API max 200; no identifying search attributes/photos |
| Search interest → persisted private match | Implemented but unverified as a full current browser flow | connectSearchReport, POST matches, owned lost-report selector | I, surrounding APIs N. Can only retrieve an existing qualified pair, not force a new match; insufficient pair returns 404 |
| Private possible-match cards and owner claim form | Implemented and verified; `/student/updates`, POST claims | Portal, workspaceService, matching/claims SQL | N/H. Numeric scores are uncalibrated; other evidence remains private. Contradiction filter still missing |
| More-information response loop | Partially implemented | Portal existing-claim branch, notes API, submit_ownership_claim | N for API resubmission; I confirms UI directs to notes and hides submission form once any claim exists. Admin cannot explicitly resubmit on student's behalf. Align answers/notes and state UX |
| Magpie Updates and mark-all-read | Implemented and verified; `/student/updates`, PATCH updates | updates table, repo, Portal | N/H. Notices for save/match/claim/information/approval/return; no realtime delivery, push, email or SMS |
| Private report correspondence | Implemented, partial conversation workflow | notes API, report_notes, Portal, staff claim review | N for storage/access. Student writes notes, staff reads and can reply with claim decisions. No general active staff reply endpoint/form in new portal |
| Student pickup pass and QR generation | Implemented and verified in core lifecycle; QR browser evidence historical | Portal.showPass, qrcode, owner claim projection | N/H. `token` duplicates code; no camera scanning. Old/expired passes need clearer UI and reissue flow |
| Campus building autocomplete | Implemented and verified; reporting and `/student/map` | BuildingSelector, campus/searchBuildings, bundled OSU JSON | N/H. Full active dataset and aliases, keyboard selection; campus switching/tenant separation incomplete |
| Google Maps campus/map-point selection | Implemented but current external service unverified | CampusMap, googleMaps loader, public Maps variables | N mocked loader, H prior UI work. Live key/billing/referrer/tile readiness not retested here. Building/unknown reporting works when map unavailable |
| Student approved drop-off guidance | Broken or blocked by missing read integration | Portal map section, workspaceService.listDropoffZones | I confirms service always returns []; DB zones managed by staff never reach student view. Empty copy misleadingly says staff tools unavailable. MAG-003 |
| Campus branding/configuration | Partially implemented | campus.ts, configured JSON/name/center, admin zone adapter, migration seed | N helper tests. OSU defaults, hardcoded staff campus ID, no tenant isolation; domain env not enforced by current login. MAG-010 |

## Image pipeline and storage

| Feature / purpose | Status | Sources and dependencies | Verification / limitations / remaining work |
| --- | --- | --- | --- |
| Shared photo picker/drop/removal/progress | Implemented and verified | PhotoUploader, storageService, sessions/Blob | N policy, H browser. Up to three files; no full-screen photo editor or automatic resize of original |
| JPEG/PNG/WebP/HEIC/HEIF, 25 MB **per image** | Implemented and verified | uploadConfig shared across picker/reserve/token/complete | N/H including 25 MB live HEIC historically. HEIC extension/sequence MIME normalization; 30 MB rejected. This is 25×1024² bytes, not aggregate size |
| Optional optimized preview and original fallback | Implemented, external codec coverage partial | imagePreview, heic2any, PhotoUploader, PrivatePhoto | H supported samples; source has 12 sec wait, 1600px WebP, <=1 MB upload. Conversion may fail/time out or consume large pixel memory; original remains valid |
| Direct private Blob upload and completion | Implemented and verified | image reserve/upload/complete routes, Blob SDK, DB metadata | N auth/policy, H real private storage. SDK-signed callback path is separate from auth completion. No public photo serving |
| Student/admin image ownership isolation | Implemented and verified | requirePhotoUser, upload_role, validate_image_report_role | N/H; staff-email student session denied. Staff workspace must be explicit in every upload/read URL; cached IDs are workspace-scoped |
| Durable report-photo cleanup/retry | Implemented and verified | migration 002, blobCleanup, cleanup-blobs script | N mocked failure/retry, H real Blob removal. Manual batch 100; no scheduler or abandoned-upload sweep |

## Active Admin Portal

| Feature / purpose | Status and route | Sources/dependencies | Verification / limitations / remaining work |
| --- | --- | --- | --- |
| Staff login, cookie and protected pages/APIs | Implemented and verified; `/admin/login`, `/admin/*` | AdminLogin, adminSession, protected layout, Neon | N/H. One configured credential pair; per-process invalid throttle; no MFA/per-staff management |
| Staff overview and recent activity | Implemented and verified; `/admin` | AdminPortal, adminRepository, staff_activity | H UI, N data. Six summary counts, 30 activity entries; not comprehensive analytics/audit |
| Found item intake with private photos | Implemented and verified; `/admin/found` | shared ReportForm, admin reports API, save_found_report | N/H. Requires active zone; found/received chronology; initial Received/Stored. Finder identity/contact not separately captured; duplicate retry not idempotent |
| Full reports, filters and authorized detail | Implemented and verified in main flow; all filters only inspected | `/admin/reports`, `/admin/reports/[id]`; adminRepository/reportView | N/H. Type/category/status/from-date/location filters, private images/attributes, report/claim history. Lists unpaginated; no generic admin lost edit, archive or delete endpoint |
| Potential comparison, dismiss and continue verification | Implemented, some actions only inspected | `/admin/matches`, admin actions, DB matches | H display; I for exhaustive dismissal/race cases. Continue Verification navigates to claim queue; it does not initiate a new staff claim or auto-approve |
| Review claim: approve/reject/request info | Implemented and verified in core lifecycle | `/admin/claims`, review_ownership_claim | N/H. Full private answers, claimant, comparison, dates. UI decision and optional private note; complete multi-claim expiry/recovery edge cases remain |
| Manual pickup redemption and returned status | Implemented and verified | `/admin/pickup`, redeem_pickup, pickups | N/H, invalid/reused code tests. Code expiry seven days; no camera scan/reissue screen. Concurrent assignment guarded by SQL locks |
| Create/edit/activate drop-off zones | Implemented and verified in core setup | `/admin/dropoffs`, POST admin/dropoffs, buildings/zones | H create, I full edit/deactivation UX. Separate from buildings; no zone hard-delete route; student read integration missing |
| Found custody updates and activity | Implemented but full UI transition matrix unverified | admin report dialog, admin actions custody | I guards allow Received/Stored/Potential Match/Claim Pending; cannot bypass active recovery or directly mark Returned/Ready. SQL claim/pickup lifecycle N/H |

## Platform, partial and planned capabilities

Origin validation, safe service diagnostics and internal health CLI are implemented (N policy; H connectivity in previous session). Build and TypeScript tooling exist. There is no committed CI workflow, typed shared staff DTO package, full browser E2E suite, verified current server deployment, AI provider/image embeddings, contradiction-first filter, score calibration, realtime update stream, multi-campus tenancy, standalone staff analytics route, robust production authentication, retention lifecycle or pickup reissue. These are **planned but not implemented**, except deployment which is **broken or blocked until provisioned/verified**.

Legacy `components/portal/DropoffZones.tsx` and Portal admin/statistics branches contain UI but are not wired to active staff routes. Their workspaceService staff adapters throw. The retained Supabase SQL/test suites are historical, not current providers. See [known bugs](KNOWN_BUGS.md), [verification](VERIFICATION.md) and [backlog](TASK_BACKLOG.md).
