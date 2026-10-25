# Magpie — three-minute demonstration runbook

This is a rehearsal plan, not a certificate that live services work. Use only synthetic identities, photos and ownership evidence. PR #1 stays unmerged until the integration lead approves the combined application. Never merge unfinished teammate branches just to make this demonstration run.

## Readiness gates — complete before starting the clock

- Review the latest main, Developer 1/2/3 logs and PRs. Prepare a clean approved integration checkout separately from ongoing feature work. Do not force-push or discard changes.
- The student branch contains information responses and bounded refresh. Main currently does not include these features. Review PR #1 before integration.
- Developer 2's recovery work is on `feature/admin-recovery`: reviewed migration `004_admin_recovery.sql` and its matching API/UI must be integrated and applied before demonstrating competing-claim protection. Publication is not proof of remote migration execution.
- Developer 3 must publish and obtain agreement on the compatibility/normalization contract, matching implementation and ordered matching migration (005 is reserved). Brand/model/color contradiction rejection is **pending**, not a capability of baseline migration 003. Do not present it as working before acceptance passes.
- MAG-003 student-safe approved-zone read API is absent. Student guidance shows explicitly labelled campus configuration and a disconnected live directory. Staff building markers are not approved desks. Do not call the staff workspace from the student UI or invent a live list.
- Review migrations in numeric order. The runner replays every SQL file; old function definitions can replace newer behavior if applied out of order. Coordinate any schema execution with the database owner. Never apply archived `supabase/` SQL.
- Complete the real acceptance driver against a disposable environment; skipped checks are unresolved gates. Independently rehearse the staff browser screens, because the driver exercises staff HTTP contracts rather than every staff UI control.

## Required local setup

From the intended clean checkout:

```sh
cd reclaim
npm ci
npm run typecheck
npm test
```

Use Node 22.13 or newer. Configure the ignored `.env.local` privately; do not replace an existing file. Service settings are not carried by Git. Use a disposable Neon branch/database and a dedicated private Blob store for rehearsal; no real campus evidence belongs here.

Required server variable **names**: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_DEMO_EMAIL`, `ADMIN_DEMO_PASSWORD`.

Optional server/tool names: `ALLOWED_ORIGINS`, `VERCEL_BLOB_CALLBACK_URL`, `MAGPIE_NEXT_DIST_DIR`.

Campus/browser names: `NEXT_PUBLIC_CAMPUS_CONFIG`, `NEXT_PUBLIC_CAMPUS_NAME`, `NEXT_PUBLIC_CAMPUS_LAT`, `NEXT_PUBLIC_CAMPUS_LNG`, `NEXT_PUBLIC_PICKUP_LOCATION`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`, `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS`. The email-domain helper is not enforced by demo login. Maps requires enabled JavaScript API/billing/referrer settings; unknown/building location works without it. Rebuild after changing browser variables.

Before any remote schema mutation, confirm the selected disposable database with its owner, review all integration migrations and backup/disposal plan, then run:

```sh
npm run db:migrate
npm run services:check
MAGPIE_NEXT_DIST_DIR=.next-demo npm run dev -- --port 3011
```

Use the actual URL printed by Next and an unused port. Never stop a teammate's server. For a production-mode rehearsal, build/start with the same `MAGPIE_NEXT_DIST_DIR` and configure the exact browser origin through `ALLOWED_ORIGINS`; keep secure-cookie behavior intact. The old static `out` artifact cannot run this application.

A fresh migrated database has no approved intake desk. Sign into staff tools, choose an active configured campus building, and create an active public intake zone. Use public handover instructions only; keep private storage notes in staff-only fields. Do not imply this desk appears in the student live directory until MAG-003 is implemented.

## Accounts and reproducible sample

Use two separate browser profiles/contexts: student and staff. Keep an unrelated-student third profile for privacy checks off the presentation clock.

- Student: `/login/`, enter a new synthetic address such as `magpie-demo-run@example.com` and optional display name. There is no password/confirmation flow. Email ownership is not verified; this is a demo identity model.
- Staff: `/admin/login/`, enter the privately configured `ADMIN_DEMO_EMAIL` and `ADMIN_DEMO_PASSWORD`. Student login with the staff email must still grant only student privileges. Never project the password or a session token.
- Synthetic item: Electronics → wireless earbuds; brand Apple; model AirPods Pro; primary color Black. Private description: black case with a hidden blue stitch. Ownership evidence: an invented engraving under the hinge. Use a generated/sample PNG, never a real student's photograph or ID.
- Set report time to about one hour ago. Location may be unknown; do not invent precise coordinates. Staff found time must precede/equal received time. Use the same descriptive attributes for the compatible found item and the approved desk for intake.
- Once the accepted matcher supports them, prepare three separate contradiction fixtures: Samsung/Galaxy Buds versus Apple, same-brand incompatible model (AirPods Max versus AirPods Pro), and confirmed incompatible primary color (White versus Black). These examples are proposed acceptance inputs until Developer 3 confirms normalization/confidence semantics. Missing or ambiguous fields must not be treated as confirmed contradictions.
- Prepare two compatible found candidates and submit a pending claim for each before approving either. This supplies a stale competing claim for the returned-state test. Do not perform that test on migration 003.

Prepare data, sign-in, upload and all preflight checks before the three-minute presentation. Keep the main recovery claim Pending, the competing claim Pending, and the staff queue ready. A previously completed acceptance-driver run is useful evidence, but its Returned records cannot be reused for a fresh pickup; make a new synthetic scenario.

## Presentation — approximately three minutes

| Time | Action | Expected result / evidence |
| --- | --- | --- |
| 0:00–0:25 | Student opens My Reports and the prepared lost report with sample photo. Briefly show public Search. | Own details/photo are private; Search shows only category, broad intake building, date and generic status. Students have no found-report submission mode. |
| 0:25–0:45 | Staff opens the prepared intake and eligible match; show approved public desk separately from private handling notes. | Staff can inspect found evidence; student match views withhold found photos/details. Similarity is an estimate, not ownership proof or AI recognition. |
| 0:45–1:05 | Show the preflight contradiction evidence and rejected fixture pair IDs. | Only after the accepted matching tests pass: incompatible confirmed attributes do not persist as active candidates. Absence from a screen alone is insufficient proof. Otherwise explicitly state the matching gate is pending. |
| 1:05–1:35 | Staff requests more information with a private question. Student clicks Refresh, opens the relevant claim and submits revised evidence. | More information appears with private report correspondence; answer includes previous evidence because resubmission replaces it. Claim returns to Pending. Ordinary report notes alone do not resubmit. |
| 1:35–1:55 | Staff refreshes Claims and reviews the updated answer, then approves with the active desk. | New evidence is visible to authorized staff; owner receives private pickup instructions/current code. |
| 1:55–2:20 | Student refreshes and opens the pass; staff redeems its code in Pickup. | One successful pickup; both lost/found reports and claim reach Returned. Avoid projecting the pass beyond the demo audience. |
| 2:20–2:40 | Staff retries the same code and attempts approval of the competing stale claim using preflight HTTP evidence if the UI correctly hides the action. | Reuse and stale approval fail; report remains Returned; no second pass. Only claim this with reviewed/deployed 004 and passing acceptance. |
| 2:40–3:00 | Student refreshes Returned state; show handover guidance and the live-directory limitation. | Open stale pass closes; guidance distinguishes buildings/configuration from live authorized desks. Explain the remaining integration gates plainly. |

Use manual Refresh to keep timing predictable. Visible-tab polling is every 30 seconds; focus refresh is throttled, not realtime. Use an offline synthetic evidence recording if all live readiness gates are not met; do not substitute fake success into production UI.

## Acceptance commands and evidence categories

**Isolated tests (no live services):**

```sh
npm test
node --conditions=react-server --import tsx --test services/studentIntegration.test.ts
```

These execute production repositories/SQL against fresh PGlite databases and route denials. Photo records are synthetic metadata, not uploaded bytes. Tests mark the terminal-state check skipped until 004 exists in the checkout. Brand/model/color hard-filter acceptance is explicitly TODO pending the accepted matcher contract; a green suite with pending tests does not prove those behaviors.

**Synthetic browser tests:** with a separate local production build/server running:

```sh
MAGPIE_STUDENT_TEST_URL=http://127.0.0.1:3011 node tests/student-portal.browser.mjs
MAGPIE_STUDENT_TEST_URL=http://127.0.0.1:3011 node tests/student-intake.browser.mjs
```

Both intercept API responses and refuse non-loopback target URLs. They prove rendering/interactions, form transport shape, selection/validation, error/retry, deletion confirmation, state presentation and navigation. They do not prove real upload bytes, authentication, Neon, Blob or deployment health. Playwright/browser must be installed in the test environment; optionally use `PLAYWRIGHT_MODULE_PATH` and `PLAYWRIGHT_CHANNEL` to select an existing installation. No production dependency changes are required.

**Real opt-in acceptance:** `tests/live-recovery.integration.mjs` performs no API interception. It signs into separate real student/staff sessions, creates a real student report via UI with PNG upload, checks private photo access, creates synthetic staff intake through existing HTTP APIs, checks persisted matching, drives the real private student response UI, approves/redeems a pass and tests participant/public isolation.

```sh
# Privately configure a dedicated disposable server/database/private store first.
# Set MAGPIE_LIVE_BASE_URL to that server and staff credentials in the test process.
MAGPIE_LIVE_ACCEPTANCE=1 MAGPIE_DISPOSABLE_ENVIRONMENT=yes \
  node --env-file-if-exists=.env.local --test tests/live-recovery.integration.mjs
```

Further **test-only** flags: `MAGPIE_MATCHING_ACCEPTANCE_READY`, `MAGPIE_RECOVERY_ACCEPTANCE_READY`. Set each to `1` only after the corresponding reviewed code/migrations/contract are deployed to the disposable environment. Disabled flags produce explicit skipped dependency checks. Do not use flags to describe unimplemented features as complete. The driver stops after a failed active step. Its log contains scoped synthetic resource IDs, not passwords/pass codes. No live run is claimed until this command is actually executed successfully with all required gates enabled.

## Privacy/security acceptance off the clock

Verify using owner, unrelated student, anonymous and staff contexts:

- Student POST of FOUND fails; student cookies do not authorize admin endpoints or `workspace=admin` photos.
- Owner sees own image; unrelated student receives 404; anonymous receives 401. Public responses contain no private Blob URLs or `/api/images/` references.
- Search keys remain exactly `id,type,category,location,date,status`; no names, brands/models/colors, unique marks, staff storage, answers or correspondence.
- Foreign deletion fails without removing the report. Active claim/pickup deletion fails safely. Eligible deletion succeeds and any failed byte cleanup remains queued for authorized cleanup.
- Staff request and resubmitted evidence are visible to owner/staff, absent from unrelated workspaces and public Search. Report-level correspondence does not identify a particular claim without a claim-linked contract.
- Returned/Archived reports cannot reopen through stale/competing decisions. Missing/expired passes offer no blank QR code; reissue is still a separate backend dependency (MAG-009).

## Failure/fallback and cleanup

- Service failure: show the actual unavailable/error state, retain safe same-account snapshots, stop mutations and inspect redacted `services:check`/server diagnostics. Do not change providers, relax origin checks, expose storage or invent successful responses.
- Maps failure: use building selection or unknown location. An external Maps link is guidance, not confirmation that a building accepts items.
- Live demonstration unavailable: run the isolated suite and synthetic browser scenarios; label them on screen as **synthetic, API-intercepted fixtures**, and describe the missing live boundary. A local recording of those fixtures is acceptable if explicitly labelled. Do not say a real recovery completed.
- Upload failure: use the supported sample PNG; preserve/report the actual error. Omitting optional photos can demonstrate reporting only, not successful private upload. HEIC/HEIF and 25 MB limits need their own sample rehearsal.
- Clean up only this run's disposable environment. The real driver prints IDs, leaves active/Returned records intact and never bypasses deletion guards or runs bulk SQL. Review queued Blob cleanup with the environment owner; then dispose the dedicated Neon branch/private store using the provider's normal process. Do not purge shared/live data or change application recovery policy to make cleanup easy.

Known limits: demo email impersonation, shared staff credentials, pending live-zone read API, pending matching contract, separate migration deployment, expired-pass reissue, no maintained CI/deployed smoke certification, no independent PostgreSQL contention proof, no AI model integration. Final combined acceptance and central-memory reconciliation belong to the integration review after teammate PRs are ready.
