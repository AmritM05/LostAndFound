# Magpie — three-minute demonstration runbook

## Ready-to-record local take — 2026-10-25

All required live service boundaries passed on the explicitly authorized disposable target. Earlier blocked/read-only statements below are historical. **Stop coding and start recording the synthetic local demonstration.** No hosted deployment is claimed. The server is running at **http://127.0.0.1:3011**. Use separate student/staff browser profiles; keep developer tools/passwords/pass codes off a public screen.

If restarting (do not rerun migrations;004–008 are deployed):

```sh
cd /Users/amritm/Documents/LostAndFound/reclaim
ALLOWED_ORIGINS=http://127.0.0.1:3011,http://localhost:3011 MAGPIE_NEXT_DIST_DIR=.next-live-rehearsal npm run dev -- --hostname 127.0.0.1 --port 3011
```

Keep the existing ignored `.env.local`. Server Gemini settings are `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-2`, `MAGPIE_AI_MATCHING_ENABLED=true`, `MAGPIE_AI_DEMO_MODE=true`; only authored synthetic evidence is approved for Google processing. Staff signs in at `/admin/login/` with the privately configured `ADMIN_DEMO_EMAIL`/`ADMIN_DEMO_PASSWORD`; do not put their values in the recording or documentation.

Clean prepared take **69edc914**:

- Student `/login/`: `magpie-demo-69edc914@example.com` (demo email identity, no password). Own report `Synthetic earbuds 69edc914` / `cb0727cf-b330-45c8-bfd8-39876d42ea8b` has a valid generated private PNG.
- Compatible found report `8031c3ad-942a-4c58-89ff-172187afd439` has measured Gemini semantic/image-to-text provenance before claims; second compatible `475add9b-4a8b-4655-a2d7-0d0123a86939` supplies the competing pending claim.
- Brand/model contradiction `8d20825d-69b5-4249-8b0a-8ee83326b3b7`, model-only `f00277af-3c81-4b35-8d4f-13f7ae911a21`, color-only `e5f58b69-29e5-41a0-8350-6b09172f4a08` have no eligible pair with this lost report. Never infer that the whole shared queue must be empty.
- Published desk `Synthetic desk 69edc914` / `655b1d8e-04e6-4bc2-9f40-4a9591ca59e5` exposes reviewed public instructions and public building coordinates, never staff notes.
- Both claims are **Pending**. Open this student's claim in staff Claims, request private details, respond in student Updates, approve at this take's desk, view student instructions/pass, redeem through staff Pickup, then refresh Returned. The full run was already verified on separate synthetic takes.

For the three-minute sequence below, show already-persisted AI explanation instead of rerunning inference after a claim starts: active-recovery protection intentionally prevents changing the match. To demonstrate a new Gemini call, select a separate fresh synthetic pair **before** making any claim and confirm synthetic processing. Do not enable Google processing on old unrelated reports.

### Safe retake / reset

Never reset Returned statuses, reuse a redeemed pass or delete unrelated records/Blob objects. Prepare a fresh uniquely named take through real endpoints (bounded real Gemini usage), leaving the old take intact:

```sh
MAGPIE_PREPARE_VIDEO=1 MAGPIE_LIVE_ACCEPTANCE=1 MAGPIE_DISPOSABLE_ENVIRONMENT=yes \
MAGPIE_MATCHING_ACCEPTANCE_READY=1 MAGPIE_RECOVERY_ACCEPTANCE_READY=1 \
MAGPIE_LIVE_BASE_URL=http://127.0.0.1:3011 PLAYWRIGHT_CHANNEL=chrome \
node --env-file-if-exists=.env.local --test tests/live-recovery.integration.mjs
```

Requires installed Playwright; `PLAYWRIGHT_MODULE_PATH` may select an existing installation. Preparation mode explicitly stops at Pending and is not a full-flow pass. The full driver without this flag executes through Returned. Optional expiry acceptance uses `MAGPIE_TEST_PICKUP_EXPIRY=1` plus the exact authorized `MAGPIE_LIVE_TARGET_FINGERPRINT`; it updates only its own synthetic pickup deadline to test real API renewal/old-code denial. Do not run these against another target without authorization.

Actual UI rehearsal: set `MAGPIE_REHEARSAL_RUN` to the prepared8-character run ID and the same disposable/live flags, then run `node --env-file-if-exists=.env.local tests/live-browser.rehearsal.mjs`. It signs in through real UI, checks staff sections, requests/responds privately and leaves the claim Pending. It uses no intercepted APIs.

Evidence:139 automated tests,1 real Gemini suite,14 real recovery tests,14 real browser checks and36 separate synthetic browser scenarios passed. Real Maps ready; live private image upload/read/isolation passed. Production build/TypeScript passed; HTTP recording server is documented development mode. HEIC live codec/object-recognition quality and hosted HTTPS deployment are not certified.

## Historical setup and sequence (current take above supersedes old readiness gates)

Integrated source is ready for local/synthetic rehearsal. A **complete live recording is blocked** by remote migration authorization/deployment and real end-to-end acceptance. No live recovery is claimed. Use synthetic accounts, evidence and sample photos only; keep passwords, pickup codes and private evidence off public recordings.

## Setup before recording

Use `integration/final-hackathon` after fetching the pushed integration commit. Draft PR #2 is intentionally unmerged; main has not received the integrated features. Use Node 22.13+ and run package commands from `reclaim/`.

```sh
npm ci
npm test
npm run typecheck
node scripts/audit-final-migrations.mjs
```

Privately configure ignored `.env.local` without replacing existing settings. Required names: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_DEMO_EMAIL`, `ADMIN_DEMO_PASSWORD`. Use a dedicated disposable Neon target and **private** Blob store. Optional names: `ALLOWED_ORIGINS`, `VERCEL_BLOB_CALLBACK_URL`, `MAGPIE_NEXT_DIST_DIR`. Campus overrides: `NEXT_PUBLIC_CAMPUS_CONFIG`, `NEXT_PUBLIC_CAMPUS_NAME`, `NEXT_PUBLIC_CAMPUS_LAT`, `NEXT_PUBLIC_CAMPUS_LNG`, `NEXT_PUBLIC_PICKUP_LOCATION`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`, `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS`. Browser variables require rebuilding; the email-domain helper is not enforced by demo sign-in.

**Do not run the following migration command against the currently connected database without new explicit authorization.** After the owner authorizes the target, review backup/disposal, pause application writes and apply sorted **001–007** through the normal runner. It commits per file, has no ledger and replays old definitions before replacements; partial failures require inspection before resuming. Never apply archived Supabase SQL.

```sh
# Only after explicit target authorization:
npm run db:migrate
npm run services:check
MAGPIE_NEXT_DIST_DIR=.next-final-demo npm run build
MAGPIE_NEXT_DIST_DIR=.next-final-demo npm start -- --hostname 127.0.0.1 --port 3011
```

Open the exact printed loopback URL on an unused port. Configure allowed origin if needed; preserve cookie/origin protections. Development alternative: `MAGPIE_NEXT_DIST_DIR=.next-final-demo npm run dev -- --port 3011`. An old static `out` artifact cannot serve the APIs.

A newly migrated database contains no published desk. Staff creates an active zone linked to an active configured campus building, enters reviewed **public** instructions and explicitly enables student publication. 007 defaults old desks hidden. Staff notes/storage coordinates must not be copied into public fields. Student map building markers alone do not certify intake; published desks have separate guidance/Maps links.

## Accounts and sample scenario

Use separate student/staff browser profiles, plus an unrelated-student profile for privacy checks before recording.

- Student `/login/`: a new synthetic address such as `magpie-demo@example.com`, optional display name. Demo email identity has no password or verification and is not production identity assurance.
- Staff `/admin/login/`: privately configured staff email/password. A student cookie never authorizes staff APIs, even with the staff email.
- Use Scenario A in [MATCHING_DEMO_CASES](MATCHING_DEMO_CASES.md): Electronics / Wireless earbuds / Apple / AirPods Pro 2 / White / “White earbud case in a blue silicone sleeve with a small clip”. Unknown location is supported. Use consistent valid past times; found precedes received. Upload only a harmless synthetic sample PNG privately.
- Concealed ownership evidence: invented blue thread under the sleeve. Never publish it as a search field. Staff receives a matching synthetic item at the active desk.
- Prepare Scenario B separately: Apple AirPods Pro versus Samsung Galaxy Buds 2, identical white/shared description. This pair must not persist as a candidate. Scenario C uses unknown-brand black backpack versus Nike and remains eligible. `services/matchingDemoAcceptance.test.ts` verifies all three with actual local TS/SQL/save triggers. Ranking is heuristic; no image/embedding AI is called.
- Prepare a second compatible found candidate and two pending claims before approving one. This supplies a stale competing claim for terminal-state testing. Do not reset Returned records or reuse a completed pickup for another take.

## Three-minute sequence

Prepare sign-in, reports, optional photo upload and pending claim before the clock starts. Rehearse all actions against the authorized migrated target first.

| Time | Action | Expected outcome |
| --- | --- | --- |
| 0:00–0:25 | Student opens own lost report and private photo, then public Search | Search shows only six generic summary fields, no identifying details/photos. No student FOUND form |
| 0:25–0:45 | Staff opens found intake and Matches | Strong potential match, stored private factors, ranking index; independent ownership verification required |
| 0:45–1:05 | Show preflight Scenario B pair and actual acceptance evidence | Hard brand/model contradiction excludes this pair despite similar description; no fabricated rejection card |
| 1:05–1:35 | Staff requests private information; student refreshes and responds | Report-scoped correspondence stays private; revised claim returns to Pending |
| 1:35–1:55 | Staff refreshes, reviews answer, approves at active desk | Student receives private pickup instructions/current pass |
| 1:55–2:20 | Student opens pass; staff verifies and redeems code | Exactly one pickup; both reports and claim become Returned |
| 2:20–2:40 | Retry code; show stale competing approval denial from actual preflight HTTP evidence if UI hides action | No second pickup; Returned cannot reopen |
| 2:40–3:00 | Refresh student status and published drop-off guidance | Stale pass closes; public location instructions remain separate from private storage |

Use manual Refresh for predictable timing; polling is bounded at 30 seconds, not realtime. Absence of a candidate alone does not prove rejection: back the exact pair with acceptance evidence. New incompatible pairs are intentionally not stored. Historical rejected/dismissed reasoning is visible only to staff where it exists.

## Test commands and evidence boundaries

`npm test` executes real repositories, migrations and security helpers in isolated PGlite; photo rows are metadata, not Blob bytes. `node scripts/audit-final-migrations.mjs` separately replays frozen 001–007 SQL without credentials or network.

With a local production server and Playwright/browser installed:

```sh
MAGPIE_STUDENT_TEST_URL=http://127.0.0.1:3011 node tests/student-portal.browser.mjs
MAGPIE_STUDENT_TEST_URL=http://127.0.0.1:3011 node tests/student-intake.browser.mjs
MAGPIE_NEXT_DIST_DIR=.next-final-demo node tests/admin-integrated.browser.mjs
```

Optional runtime selectors: `PLAYWRIGHT_MODULE_PATH`, `PLAYWRIGHT_CHANNEL`. Student suites intercept all APIs. Staff harness bundles the real AdminPortal with mocked Next router/API and compiled production CSS on loopback. These prove browser behavior, not real auth, data transport or storage. Never label them live service success.

After explicit disposable-target authorization and migration deployment, run the real driver without API interception (this creates sessions/data/uploads):

```sh
MAGPIE_LIVE_ACCEPTANCE=1 MAGPIE_DISPOSABLE_ENVIRONMENT=yes \
MAGPIE_MATCHING_ACCEPTANCE_READY=1 MAGPIE_RECOVERY_ACCEPTANCE_READY=1 \
node --env-file-if-exists=.env.local --test tests/live-recovery.integration.mjs
```

Privately set test-only `MAGPIE_LIVE_BASE_URL` and staff credentials for that target. Without opt-in, it skips. Enable readiness flags only when reviewed code/migrations are deployed. Also rehearse actual staff UI separately; the driver uses staff HTTP actions. Verify owner/unrelated/anonymous/staff photo access, FOUND denial, six-key public search, foreign deletion denial, active-recovery deletion protection, private response isolation, old/reused code rejection and terminal protection.

## Fallback and limits

If external services fail, show the real unavailable states and stop mutations. Use unknown/building location without Maps. Do not replace production results with fake success or change providers. A recording of explicitly labelled **synthetic API-fixture browser tests** plus local SQL evidence is available; explain that real upload/auth/recovery remains unverified.

Known limitations: remote 004–007 not deployed/authorized; no final live upload/recovery run; demo email impersonation/shared staff credentials; no AI model; no independent multi-connection PostgreSQL contention proof; no maintained CI/deployed smoke certification. Queued cleanup needs an authorized operator. Clean only this run's disposable resources; never bypass active-recovery deletion guards or bulk-delete shared data. See [FINAL_INTEGRATION_PLAN](FINAL_INTEGRATION_PLAN.md).
