# Final hackathon integration — preparation and recording gates

**2026-10-25. Status: preparation only; not ready to record a complete live recovery.** The project lead explicitly answered “Not yet—prepare without merging” and “No—keep remote checks read-only”. No feature branch has been merged into `integration/final-hackathon`; no remote migration, session creation, upload, intake, claim or pickup was executed. Main and all feature branches remain intact.

## Reviewed snapshots

| Branch | Reviewed commit | Evidence / current gate |
| --- | --- | --- |
| main | `6cc04d2a756bc038b3933dd16a2727099aedba9e` | Clean original checkout, fetch/pull fast-forward-only; basis of integration preparation |
| feature/student-experience | `a686d212026b7fc1f99465951e7c327d255512ed` | PR #1 remains open. Published UI, private responses, bounded refresh, student tests/runbook; not merged |
| feature/admin-recovery | `50631066c209d6ebe2169a811ac21769962cc2e9` | Published terminal guards/information requests and pickup reissue; latest log says ready for review, but lead says final teammate work is not yet finished |
| feature/matching-engine | `7d831aa6d09ddfe56727be20144e0e2c84f137f3` | Published compatibility-first matcher and migration 005; final completion confirmation remains required |

The machine-readable pins are in `tests/final-integration-snapshots.json`. Fetch/review any newer commits and obtain completion confirmation before changing those pins or merging. Published handoffs do not override the lead's explicit hold. Preparation changes are isolated in `/private/tmp/magpie-final`; original main and student checkouts are preserved. Admin/matching validation used separate detached snapshots, never branch switches in teammate checkouts.

## Merge and conflict plan — execute only after the hold is lifted

1. Check clean status, branch/upstream, fetch origin and inspect all new commits/logs. Integrate relevant newer main safely into this integration branch; do not pull an upstream blindly if it names a different branch. Preserve uncommitted work; never automatically stash/reset/force.
2. Obtain confirmation that each teammate's final assignment is finished and pushed. Select and record exact reviewed SHAs; do not merge a moving or unfinished head.
3. Merge Student Portal, run the full suite and TypeScript. Merge Admin Recovery next, resolve intended overlaps and rerun checks. Merge Matching Engine last, resolve the fixture conflict below and rerun all checks. Use ordinary non-force history-preserving merges. No automatic merge into main and no feature branch rewrite/deletion.
4. Resolve central documentation/Developer 1 log overlaps by preserving each historical entry and adding the final source/evidence snapshot. Never edit Developer 2/3's handoff logs to manufacture agreement. Reconcile stale pending/Done claims in central memory only after actual integration verification.
5. Build and run both student and staff browser acceptance at mobile/desktop sizes on the combined application. Recheck public/private boundaries and absence of student FOUND submission. Then run real acceptance only on an explicitly authorized disposable target with reviewed migrations applied.

### Known overlaps

| Surface | Observed changes | Intended resolution |
| --- | --- | --- |
| `services/adminBackend.test.ts` | Admin changes migration replay from 003 to repeated 004; matching adds repeated 005. Neither diff removes business assertions | Retain meaningful assertions from both. Keep historical replay plus ordered new guards/matcher/reissue: 001,002,003,003,004,004,005,005,006,006 is an appropriate fixture sequence to review. Do not select one whole-file side or run 003 after the final replacements |
| `db/migrations/` | Admin 004/006, matching 005, no colliding filenames | Apply all sorted 001–006 only to an authorized target. 004 replaces recovery functions; 005 replaces matcher and adds staff_reasoning; 006 adds renewal without overwriting 004/005 |
| `memory/team-updates/developer-1.md` | Student history and integration-preparation entries both append to the setup baseline | Preserve both dated histories; do not erase student verification/publication or the explicit current hold |
| Staff match consumer / owner projections | Matching adds detailed `staff_reasoning` to staff rows; owner/public DTOs remain whitelisted | Review staff-only consumption and safe classification labels after merge. Never forward contradiction details/identifiers to students or public search. Do not describe indices as ownership probabilities or photo AI |
| Student response / recovery | Existing POST claims payload remains `{matchId,answer}`; 004 preserves previous evidence privately and returns Pending; 006 rotates the existing pass | Keep that contract. Report notes have no claim/request ID: label correspondence as report-scoped. Check student refresh after information, approval, renewal and return |
| Approved student zones | No safe student GET exists in the reviewed snapshots; admin APIs are protected/full-private | Keep truthful unavailable/configuration guidance. Ask the admin/API owner to finish/confirm the safe active/approved/student-visible public projection. Do not call admin workspace from students or fabricate live desks |

## Reproducible local planned-SQL audit

Run from `reclaim/` with installed dependencies and fetched pinned Git objects:

```sh
node scripts/audit-final-migrations.mjs
```

This reads SQL from the exact reviewed Git commits into an automatically removed temporary folder and executes it in fresh PGlite. It performs no Git merge, reads no environment file, and cannot connect to Neon or Blob. The test lives in `services/finalMigrationSequence.test.ts`; its ordinary suite invocation skips when 004–006 are absent from the checkout. The explicit snapshot audit is a separate evidence category.

The passing audit verifies: 001–006 execution; 005/006 do not replace 004's claim/review/redemption function bodies; compatible persisted candidates; Apple AirPods Pro versus Samsung Galaxy Buds produces no active match despite identical descriptions; incompatible known model and Black/White fixtures also reject; owner/staff-only correspondence and six-key public search; More information→revised answer→Pending; expired pass→renewal→old-code denial; one successful pickup; stale competing approval cannot reopen Returned; full ordered migration replay preserves guard bodies and Returned data. Photo bytes, HTTP authentication, real Neon concurrency and combined UI are not covered by this SQL audit.

## Fresh verification — keep categories separate

| Scope | Actual result | Limit |
| --- | --- | --- |
| Preparation checkout normal `npm test` | 60 passed, 0 failed, 1 skipped | Main application + preparation test; skip is expected without integrated feature migrations |
| Pinned planned-SQL audit | 1 passed, 0 failed, no skips | Local PGlite only; not a feature merge or live migration |
| Detached admin snapshot full suite | 72 passed, 0 failed | Admin branch alone; no combined student/matching UI claim |
| Detached matching snapshot full suite | 65 passed, 0 failed | Matching branch alone; no combined recovery UI claim |
| Preparation TypeScript / production build | Passed; 26 static pages plus server routes | Current main-based preparation app, not the unmerged final application |
| Published student browser fixtures | 23 passed (13 recovery/mobile + 10 intake/deletion/search/desktop), 0 failed; no page errors/unexpected APIs | All API-intercepted, no service writes; unchanged student snapshot only |
| Neon connectivity | SELECT/read-only schema checks passed | No remote migration or live authentication/recovery |
| Blob connectivity | Read/list token accepted | Does not prove authenticated writes, final private-store policy or cleanup |

Counts overlap between branches; do not add them into a fictional integrated test total. Existing suites include archived Supabase coverage; current runtime remains Neon and private Vercel Blob. No AI model/provider is integrated.

## Remote migration/deployment status

Read-only inspection found the expected 005 evaluator/reasoning column and 006 reissue function absent. Current `submit_ownership_claim`, `review_ownership_claim` and `redeem_pickup` bodies do not match reviewed migration 004. Thus this configured database is **not verified compatible with the planned final application**. There is no migration ledger, so inspection cannot reconstruct which scripts were historically run or whether someone later replaced functions.

Required new reviewed files: `004_admin_recovery.sql`, `005_matching_engine.sql`, `006_pickup_reissue.sql`; run through the normal sorted 001–006 runner after authorization, not three out-of-order snippets. 005 backfills existing match assessments/introduces a column; it is a data/schema mutation even though no table is dropped. The current user authorization forbids all remote writes. No SQL was applied, no records populated, no Blob upload/deletion occurred, and no deployment was promoted. Do not enable new staff UI on an old schema.

Before changing that status: identify the disposable database/store, explicitly authorize the target, review backup/disposal/forward-fix plan and secrets, apply reviewed sorted SQL, verify function/body/policy markers and migration results, then execute live browser/HTTP acceptance with both matching and recovery checks enabled. PGlite does not establish independent PostgreSQL connection contention safety.

## Exact demo startup — after readiness approval

The reviewed detailed three-minute guide remains on the unmerged student branch: [DEMO_RUNBOOK.md at the student snapshot](https://github.com/AmritM05/LostAndFound/blob/a686d212026b7fc1f99465951e7c327d255512ed/reclaim/memory/DEMO_RUNBOOK.md). It becomes available locally after the authorized student merge; reconcile its older pending statements with the completed integration evidence.

After branches are finished/merged, an authorized disposable target is migrated and its settings are privately configured in the integration checkout:

```sh
cd /private/tmp/magpie-final/reclaim
npm run services:check
MAGPIE_NEXT_DIST_DIR=.next-final-demo npm run dev -- --port 3011
```

Use the actual free port/URL printed by Next; do not stop a teammate's server. Required server variable names only: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `ADMIN_DEMO_EMAIL`, `ADMIN_DEMO_PASSWORD`. Campus/Maps overrides remain configurable. Never copy credentials into Git or send their values in a handoff. Production-mode rehearsal requires build/start with the same dist directory and exact allowed origin; do not bypass origin/session rules. An old static `out` deployment cannot serve these APIs.

Use separate synthetic student and staff browser profiles. Prepare a private sample photo/lost report, compatible staff intake, deliberately contradictory intake and two pending claims for a stale-decision test. Rehearse private request→student answer→staff review→approval→single pickup→Returned with manual Refresh for predictable timing; show contradictory-pair absence backed by acceptance evidence. No found photos/details in public search or student match views. Stage setup/data outside the three-minute recording and do not reuse a Returned pass for another take.

## Recording decision / next action

**Not ready to record the claimed complete live workflow.** Remaining gates: teammates finish and confirm final heads; authorized feature merges/test conflict resolution; approved-zone API dependency; real target authorization and reviewed migration deployment; complete live student/staff/photo/privacy/contradiction/pickup acceptance; staff and student mobile/desktop visual rehearsal. UI-only polish starts after that workflow is verified; do not risk unrelated redesign or business-logic changes now.

Independent preparation is ready for review through the integration PR. Keep it draft/unmerged while the hold remains. If live services fail, show explicitly labelled local SQL/synthetic browser evidence or a synthetic rehearsal recording and state the missing live boundary. Never hardcode successful results, invent AI, or claim this preparation PR is the combined app.
