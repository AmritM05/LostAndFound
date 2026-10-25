# Verification ledger

## Fresh checks for this memory task — 2026-10-24

Baseline `6bf17fd`, clean main tracking origin/main; `git pull --ff-only` returned already up to date. The task only adds documentation and a startup pointer, without changing runtime code, credentials, schema or service data.

| Check | Observation and limit |
| --- | --- |
| `npm test` in application root | PASS: 60 tests, zero failures. Node test runner, tsx, PGlite and helper/API tests. No browser or remote network required |
| `npm run typecheck` | PASS on baseline source; not strict mode and not a deployed runtime test |
| Isolated recovery-state probe | Confirmed one lost/two found/two pending claims can reopen a Returned lost report via second approval; PGlite only, no live data touched |
| Direct matching helper probe | Confirmed Apple/Samsung contradiction scores 70 above threshold 60 using same color/generic description/time/location; documented in KNOWN_BUGS |
| Referenced source files / Markdown fences | PASS: 42 distinct existing source references checked; planned endpoint path explicitly excluded from existence requirement; fenced blocks balanced |
| Source route/function inventory | Active Route Handlers, layouts, repositories, migrations, adapters and tests inspected; no Server Actions or middleware found |
| Markdown links / required files / secret scan | PASS: all 15 requested documents plus VERIFICATION exist; 50 internal links resolve; 22 task IDs are unique and every reference is defined; all 17 new documentation files passed secret scanning. A successful check does not certify all prose forever |

A new production build and live Neon/Blob/Maps/browser operations were not required or rerun for these documentation-only edits. Do not represent earlier live tests as freshly reproduced here.

## Previous implementation-session evidence

The existing application README and the preceding implementation session reported a successful production build/typecheck, live Neon and private Blob connection, application of migrations 001–003, real HEIF/25 MB HEIC uploads, owner deletion and Blob removal, and a synthetic student → found intake → match → more-information → approval → pickup → returned lifecycle. Browser checks covered student/admin sign-in, found intake, private matches, claim approval and manual pickup. Synthetic reports/desks/photos were subsequently cleaned. This is previous-session evidence, not a committed repeatable end-to-end suite or a current deployment-health guarantee.

No compatible current server deployment has been verified. The retained static hosting configuration cannot certify the current API app. Maps loader tests do not prove a teammate's Google project billing/referrer settings work.

## Test map and evidence quality

| Test files | What they prove |
| --- | --- |
| `services/adminBackend.test.ts` | Active migrations/repository: admin credential comparison, staff API denial, found intake, automatic matching, owner claims, approvals, private pickup passes, redemption, image role binding |
| `services/neonBackend.test.ts` | Active relational persistence, owner projection/editing, optional building/map/unknown location, image ownership, public search projection |
| `services/reportDeletion.test.ts` | Shared upload policy; active recovery/deletion guards; related-data deletion; cleanup outbox and mocked Blob failure/retry. Fixture disables automatic matching to isolate explicit pairs |
| `services/apiAuthorization.test.ts`, `origin.test.ts` | Missing-session/cross-origin rejection and local/Vercel-policy cases; no full authenticated Vercel proxy test |
| `services/googleMaps.test.ts`, `buildingSearch.test.ts` | Shared Maps loader behavior, buildings/aliases and email helper behavior; no real map tiles |
| `services/reportFields.test.ts`, `matchingService.test.ts` | Form helpers/campus parsing/reference ranking, not hard rejection of contradictions or actual AI |
| `services/privacy.test.ts`, database portion of `intake.test.ts` | Archived Supabase SQL authorization/intake/pickup regressions under simulated auth/storage schemas; these do **not** prove equivalent live Neon endpoints |
| Non-database portions of `intake.test.ts` | Current building search and missing-coordinate scoring helper checks |

There is no committed Playwright/Cypress browser suite or GitHub Actions workflow found in the baseline. A test name may sound current while exercising legacy SQL: read its imports and loaded migration path.

## How future evidence should be recorded

For each feature: record commit/branch, command or reproducible manual steps, environment category (local/PGlite/live test/preview/production), expected vs observed behavior and what was not tested. Use synthetic photos and identities, avoid credentials/private evidence, and clean up explicitly scoped disposable data. Store durable summaries here or in the feature document; ephemeral machine-specific logs/screenshots are supplemental, not the sole shared source of truth.
