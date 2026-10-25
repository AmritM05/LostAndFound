# Three-developer coordination

## Status: preliminary proposal, not assigned ownership

Developer 1 is the project lead; Developers 2 and 3 are teammates. Names, availability, branch claims, repository permissions and final assignments are not provided. The split below follows inspected active modules and minimizes overlap; the team must accept it before feature work. No task is currently reserved to a person by this document.

| Proposed workstream | Primary working files | Suggested initial task | Boundaries / dependencies |
| --- | --- | --- | --- |
| Developer 1 — student experience + lead integration/deployment coordination | `components/portal/Portal.tsx`, `useWorkspace.ts`, `EditLostReport.tsx`, `DeleteReportAction.tsx`, student pages/AuthForm/sessionService; student-only portions of workspaceService | MAG-005: make the More information response flow actionable using existing private APIs; plan MAG-006 deployment and adopt MAG-004 when its contract is ready | Does not change admin APIs, shared report/photo props, central CSS/tokens or schema without review. Student zone UI waits for MAG-003. Matching labels wait for MAG-001 |
| Developer 2 — actual staff experience and recovery workflow | `components/admin/AdminPortal.tsx`, `AdminLogin.tsx`, `app/admin/(portal)/`, `app/api/admin/`; recovery-function regression tests by agreement | MAG-008: reproduce/guard returned lost reports against second claim approval, using a reserved migration and DB review | Active staff APIs are not old workspaceService stubs. Coordinate claim/pickup schema/functions with Developer 3; isolate a dedicated recovery migration from matching migration. Do not edit the old Portal admin branches concurrently |
| Developer 3 — backend/database/matching/infrastructure | `lib/server/`, `db/migrations/`, `scripts/`, `services/matchingService.ts`, `imageAnalysisService.ts`, backend tests | MAG-001: agree compatibility/unknown-data contract and queue MAG-002 regression/implementation; provide the small safe zone read contract MAG-003 | Coordinate staff-owned API/recovery edits, new migration numbers, owner projections and all payload changes with consumers. No provider swap or private-image AI processing without agreement |

This is a module-oriented proposal, not exclusive ownership of entire folders forever. The project lead should resolve ambiguity before two developers modify the same function. A workstream may contribute tests/contracts without taking over the implementation owner.

## Required startup procedure

1. `git status`; identify active branch, root and upstream. Read local diffs and any applicable AGENTS.md.
2. Preserve uncommitted teammate work. If clean and tracking the intended upstream, use `git pull --ff-only`; do not pull over local changes or run automatic stash/reset. If divergent, inspect `git log --left-right --graph HEAD...@{u}` and agree how to integrate without losing commits.
3. Read memory README, CURRENT_STATUS, this file and CHANGELOG, then review recent teammate commits/PRs.
4. Read the relevant feature document and API_CONTRACTS/DATABASE as needed.
5. Confirm the task is not already implemented or claimed; check dependencies and source status rather than UI screenshots.
6. Claim a task/branch in the register below through the agreed PR/issue/team channel, list shared files and expected interfaces, and resolve overlap.
7. Create an isolated feature branch/worktree from a synchronized main, then implement. Never use the same checkout across simultaneous branch switches, commits, installs or build output.

## Git and branch rules

Use separate feature branches and PRs into `main`. A default naming pattern is `codex/<task-id>-<short-purpose>` for coding-agent work, or an agreed developer prefix. Do not have all three developers directly push to main. Keep one task/compatible set of changes per branch and preserve uncommitted work in other checkouts. Existing root and app directories are one current Git repository; run `git rev-parse --show-toplevel` before committing.

If multiple Codex sessions use one physical directory, their files/index/branch are shared immediately. Prefer separate clones or worktrees for concurrent work. A different branch name in the plan does not isolate files by itself. Use different ignored MAGPIE_NEXT_DIST_DIR outputs for dev/build if necessary. Never kill another developer's server to claim port 3000; use Next's printed alternate port.

Fetch/review main before starting and before final integration. A clean feature branch can merge current main or rebase its own unpublished commits according to team agreement; never rebase someone else's published branch or force-push without explicit agreement. Fast-forward-only pull failure is a signal to inspect, not a reason to reset.

## Shared-file ownership and change windows

| Shared surface | Why conflicts/regressions are likely | Rule |
| --- | --- | --- |
| `app/globals.css` | Student, staff and global styles live together | Reserve selector ranges/change window, keep diffs localized; both UI owners review shared tokens/forms |
| `lib/types.ts`, `lib/server/validation.ts` | Shared report DTO and validation requirements | Agree payload/version and consumer rollout before editing; do not independently rename fields |
| `components/portal/ReportForm.tsx` | Both lost and found intake | Both portal owners review props/defaults/validation; student mode must never grant found authority |
| `PhotoUploader.tsx`, `PrivatePhoto.tsx`, `lib/uploadConfig.ts`, `imagePreview.ts`, `services/storageService.ts` | Both roles, private auth query scope, byte cap, preview lifecycle | One coordinated patch per shared concern; keep role/HEIC/size tests and browser sample checks |
| `BuildingSelector.tsx`, `CampusMap.tsx`, `lib/campus.ts`, campus dataset | Both forms/map and DB seed | Coordinate campus shape, active buildings versus zones and seed rollout |
| `services/workspaceService.ts`, `apiClient.ts`, server projections | Consumers share imports, but old staff functions are inactive | Own edits by named functions; use active admin APIs, don't revive stubs accidentally |
| `lib/server/http.ts`, origin/session/db helpers | Central security/error behavior affects every mutation | Require a security/consumer review and origin/role-denial regression checks |
| `db/migrations/`, migration runner | Three functions may change in separate PRs; runner replays all files | Reserve a unique ordered number, review final function definitions after all migrations, coordinate shared DB apply |
| `package.json`, lockfile, Next/TS config | Dependency/build drift and generated edits | One integrator coordinates dependencies; never copy another install's partial lockfile or commit build-directory noise |
| `services/adminBackend.test.ts`, other shared active suites | Multiple feature teams may edit one long lifecycle fixture | Assign test sections or separate focused test files using the existing runner; keep shared setup consistent |
| `memory/CURRENT_STATUS.md`, `TASK_BACKLOG.md`, `CHANGELOG.md`, `API_CONTRACTS.md` | Every PR updates these | Keep append/status diffs small; resolve facts chronologically, preserve other task entries |

Shared UI isolation may be useful later (for example splitting named student dialogs or staff panels), but that is a separately scoped refactor after routes/props are agreed. Do not begin a large component split while three feature branches edit the same file.

## Contracts needed before parallel consumers

1. MAG-001 compatibility decisions, score/label meaning, unknown values and SQL/TS responsibility.
2. MAG-003 active-zone read payload, auth/privacy whitelist and adapter shape.
3. MAG-008 terminal report/competing claim policy, errors, notices and required SQL locks.
4. MAG-005 answer resubmission versus correspondence semantics; agree which evidence the staff screen reads.
5. MAG-009 expiry/reissue contract and old-code invalidation before either portal adds controls.
6. Any pagination/error-code/AI change must define typed DTOs and backward/forward rollout. Admin workspace currently mixes camelCase report views with snake_case collections.

A blocked consumer may work on pure view/error states or a reviewed interface mock in tests, but must not ship an invented backend success fallback.

## Database changes

Reserve the next migration number in the task claim. Existing files 001–003 are published history; prefer new additive/idempotent migrations for new behavior. Since the runner replays old SQL, a new function replacement must sort after older definitions and be tested by replaying the whole directory. Migration numbering, not the branch's merge time, determines the resulting function. Keep competing feature migrations focused and verify combined order.

Use isolated local/PGlite or per-branch Neon databases when possible. Never point destructive tests at a shared/live database. Identify who applies a reviewed migration, which environment/backup is affected, expected locks/backfill, rollback/forward-fix plan and which application versions remain compatible. No schema/credential changes are part of this documentation task.

## Breaking changes and communication

Before an incompatible API/schema/shared-component change, record a short change note with task/branch, old/new contract, affected consumers/files, migration and deployment order, rollback plan and required reviewers. Notify teammates through the agreed human channel or PR; this document does not authorize agents to send external messages. Prefer additive contracts so old clients and previews can coexist during integration. Feature ownership claims must be visible to all three, not just in one local Codex chat.

## PR and integration procedure

1. Keep the PR focused; lead with the trigger/problem and final behavior, not conversation history.
2. Include source/API/schema changes, privacy implications, tests, manual checks and known limits. Link task ID and affected memory docs.
3. Run relevant tests, typecheck and production build for application changes. Add meaningful regression cases for actual defects; no tests merely mirroring trivial documentation edits.
4. Obtain the affected module owner's review; shared auth/schema/photo changes require the counterpart reviewer even if only one source file changed.
5. Integrator checks current main, combined migration order/contracts and green checks, resolves overlaps with both authors, then merges according to repository policy. Do not assume branch protection or GitHub Actions is already configured.
6. Each teammate synchronizes cleanly after merge and validates their dependent workflow. Record the merged commit/PR and status/evidence in memory.

Resolve conflicts by understanding both intended behaviors, not choosing one whole-file version. Re-run relevant suites on the combined result; preserve teammates' unrelated changes. If an ownership/dependency conflict cannot be safely resolved, stop that overlapping edit and coordinate; continue independent documentation/tests if useful.

## Required completion procedure

Test changed behavior; update relevant memory; mark backlog completion with evidence; refresh CURRENT_STATUS; append CHANGELOG; describe any interface/schema changes and remaining risks; report exact files. Do not rewrite unrelated history, commit secrets or automatically push incomplete work. Documentation PRs need existence/link/reference/secret checks rather than a redundant app refactor.

## Task claims register — initially empty

| Task | Developer | Branch / PR | Shared files / migration reservation | State / next dependency |
| --- | --- | --- | --- | --- |
| No accepted claims yet | Unassigned | None | None | Preliminary split awaits team confirmation |

Do not treat this placeholder row or a suggested developer above as a lock. Add explicit dated claims and remove/reconcile stale reservations after merge/abandonment. Use one integrator to reconcile concurrent register edits.
