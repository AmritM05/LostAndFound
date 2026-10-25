# Known bugs, gaps and historical fixes

## Integrated resolution status — 2026-10-25

The defect descriptions below preserve the original main baseline; they do not describe the merged integration branch. K-01: fixed by compatibility-first TS/SQL005, A/B/C and brand/model/color persistence tests. K-02: fixed by staff publication SQL007, authenticated public projection and wired student adapter/Maps links. K-03: guarded by SQL004 and competing/terminal acceptance. K-04: private response UI and previous-evidence preservation integrated. K-05: SQL006 renewal and staff UI integrated. K-06: bounded 30-second refresh/manual retry implemented; no realtime guarantee. All are locally verified, **not remotely deployed**. K-07 campus generalization, K-08 legacy cleanup, K-09 operations/CI/live acceptance and K-10 intake idempotency remain limitations unless separately accepted.

Connected remote database lacks 005–007 markers and current recovery definitions differ from004; writes are unauthorized. No final live upload/auth/pickup run. Demo identity and independent PostgreSQL concurrency risks remain. See FINAL_INTEGRATION_PLAN for exact recording gates.

## Historical baseline findings


Baseline `6bf17fd`; inspected 2026-10-24. This file records findings, not fixes performed by the memory task. “Confirmed” means inspected executable behavior or a reproducible isolated probe; “risk” means source-derived and needs further reproduction. All references are relative to application root. See [backlog](TASK_BACKLOG.md) and [verification](VERIFICATION.md).

## Confirmed current defects and incomplete flows

### K-01 — Contradictory attributes can generate matches (P0, MAG-001/002)

There is no compatibility rejection stage in `services/matchingService.ts` or the migration-003 matcher. A fresh helper probe gave Apple AirPods versus Samsung Galaxy Buds a score of 70 (threshold 60) with black color, generic shared description, equal time and coordinates. This contradicts the requested product rule. Add normalized high-confidence compatibility before ranking, in the active SQL path as well as the reference helper, with nonmatching/unknown attribute regression cases. No AI model will automatically solve this policy defect.

### K-02 — Students never receive configured drop-off zones (P0, MAG-003/004)

`services/workspaceService.ts:listDropoffZones` returns an empty array. `components/portal/Portal.tsx` uses it for the student map's approved intake list. Staff can configure active zones in Neon, but no safe read endpoint connects them to students. CampusMap marks buildings, not staff-managed DB zones. The empty copy falsely says staff tools are unavailable. Implement a reviewed safe active-zone projection, wire the student consumer, and distinguish buildings from approved intake.

### K-03 — Approval can reopen a returned lost report (P0, MAG-008)

Fresh isolated PGlite reproduction using migrations 001–003: create one lost report and two compatible found reports; submit a pending claim for each pair; approve and redeem the first; approve the second. The second approval succeeds and changes the lost report from **Returned** to **Ready for Pickup**. `review_ownership_claim` checks the selected found report's closed state and competing Approved claims, but not the lost report's Returned/Archived state after the earlier claim becomes Returned. It also leaves competing pending claims available. This was not tested on live user data and the existing 60-test suite does not cover it.

Required fix: define/guard terminal recovery states for both reports under locks, specify what happens to competing claims/matches, reject stale decisions and add active-Neon migration regression tests. Preserve private notice semantics and avoid silently reopening a completed recovery. This task is documentation only; the defect remains in source.

### K-04 — More-information UI does not expose claim resubmission (P1, MAG-005)

SQL `submit_ownership_claim` accepts new evidence for a More information claim and changes it back to Pending. However, Portal's existing-claim branch hides the form and directs the student to report correspondence. Notes persist and staff can read them in report detail, but the claim answer/status does not automatically update. Align the student answer-resubmission/notes flow and staff evidence view; don't describe the complete loop as fully implemented merely because the API is tested.

### K-05 — Expired pickup passes have no recovery flow (P1, MAG-009)

Owner projection hides expired codes; redemption rejects them. Claims/reports can remain Approved/Ready for Pickup, and review only accepts Pending/More information, so staff cannot simply approve again. No reissue endpoint/UI exists. Portal's Approved branch may still offer a pass action without a current code. Define revocation/reissue semantics and private updates before adding a button.

### K-06 — Cross-tab/cross-user views can become stale (P1, MAG-012)

Student useWorkspace refreshes for same-window custom events and storage events, but backend writes do not update browser storage or broadcast staff changes to other tabs. Staff actions reload only the current staff view. No polling, push or focus-refresh exists. Student matches/approval may need navigation/reload. Existing selected-dialog object snapshots may also retain pre-refresh values. Do not claim realtime notifications.

### K-07 — Campus configurability is incomplete (P1, MAG-010)

Staff zone adaptation hardcodes a campus ID in AdminPortal. The seed's conflict updates omit campus_id and do not deactivate buildings absent from a new config. No DB tenancy boundary exists. Student login explicitly bypasses allowedDomains. This is a configurable single-campus demo with gaps, not tenant-isolated multi-campus support.

### K-08 — Inactive legacy staff interfaces remain (P2, MAG-016)

Portal's old admin/statistics branches and `components/portal/DropoffZones.tsx` are not the active staff app. Old workspaceService staff adapters throw unavailable; useWorkspace(adminPortal=true) deliberately returns an empty state. Active routes instead render components/admin and use admin APIs. Enabling/reusing old branches would regress behavior. Document/deprecate or carefully remove them after both portal owners agree, not as part of this task.

### K-09 — Operational coverage is incomplete (P1/P2, MAG-013/014/015)

Abandoned uploads remain unattached; report cleanup retries are manual batches, without a scheduled worker/backoff/retention policy. Current staff lists are unpaginated; Search returns only 200 rows before client filtering. No committed browser E2E suite or CI workflow is present. Archive/privacy tests run old Supabase SQL and must not be mistaken for active Neon coverage. Full filter/accessibility/browser error matrices are not verified.

### K-10 — Found-intake retries are not idempotent (P1, MAG-017)

`save_found_report` rejects an existing report ID, unlike student save's owned-ID early return. ReportForm generates a fresh ID on each submit. A response lost after a successful write may cause a second staff record on retry, especially without images; bound image IDs may instead make retry fail. Reproduce network-response loss and agree an intake idempotency key/owned retry response before implementing it.

## Source-derived risks needing focused reproduction

- Matching parity/lifecycle (MAG-007): SQL versus TS feature inputs/rounding need broad parity tests; dismissed improved pairs stay dismissed; below-threshold pairs with claims remain; simultaneous opposite-type inserts can miss candidates. The current matching trigger reads all opposite active reports and has no version/backfill contract.
- Multi-claim concurrency/lock ordering (MAG-008/007): SQL uses report/match/claim locks, but tests run sequential fixtures, not a real concurrent Neon load. Do not generalize single-use/assignment tests into proven global concurrency safety.
- Error diagnostics (MAG-018): db.ts classifies most non-allowlisted database exceptions as connection failures, including some input/constraint errors. Body parser accepts any JSON; some null/non-object requests can become 503 instead of 400. Route statuses are not stable typed error codes.
- Private-photo validation (MAG-019): metadata/type/extension and Blob HEAD checks are implemented, not full file-content/codec/security validation. Very large pixel counts can be expensive despite a 25 MB byte cap. Historical browser sample conversion succeeded, but some originals may only offer downloads.
- Production identity (MAG-020): student email impersonation and a shared staff demo credential pair are intentional limitations, not bugs accidentally fixed by UI privacy. Current rate limits/session management are not production identity controls.

## Previously reported issues with fixes present in current source

| Historical issue | Fix evidence | Current qualification |
| --- | --- | --- |
| “Request origin is not allowed.” on localhost | Prior browser reproduction: internal all-interface bind differed from browser localhost on port 3001. Central origin policy accepts local aliases/ports in dev and trusted Vercel hosts; origin.test.ts rerun passes | Not a confirmed active local bug now; custom proxies and actual Vercel deployment still need environment smoke tests |
| Generic Magpie server failure | Invalid/unusable credentials and unapplied schema were diagnosed in previous implementation session; db/blob service-specific safe errors and health script added, migrations then applied and live flows reported successful | Credential/connectivity status can change; not freshly checked on remote services in this documentation task. Never hide an underlying 503 |
| HEIC/HEIF rejection / old 3 MB cap | Shared uploadConfig accepts HEIC/HEIF extension/MIME variants at 25 MB per image; reservation/token/completion share it; policy tests pass | Old static demo/archived Supabase SQL retain historical constraints; do not conflate them with current runtime. Codec previews can still fail safely |
| Missing report deletion / blocked cleanup | Migration 002, DELETE route, confirmation and durable retry implemented; tests pass; previous live Blob deletion was verified | Active recoveries intentionally block deletion; pending cleanup is not a failed DB delete. No found-item delete workflow is promised |
| Missing Admin Portal / student privilege escalation | Separate server-protected admin pages/APIs/session and explicit image workspace roles are implemented; active tests pass | Basic admin exists; don't mark it wholly missing. Terminal claim-state bug K-03 and demo-auth limits remain |
| Broken map loading/repeated scripts | Shared loader, auth/readiness/tile diagnostics and optional-location fallback exist; googleMaps.test.ts passes | Actual key/billing/referrer/map tiles not checked in this task. Student zones gap K-02 is separate from map SDK health |

## Deployment status

No compatible current Next.js server deployment has been verified. Historical `.openai/hosting.json` targets static `out`, which cannot serve the active APIs. Treat hosted end-to-end demo readiness as **blocked pending deployment verification**, not as a source-code bug or a reason to switch providers. MAG-006 covers deployment ownership and smoke tests.
