# Magpie — three-minute demonstration runbook

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
