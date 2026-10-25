# Three-developer coordination

## Confirmed assignments and branches

These assignments are confirmed by the project lead's publication request. Developer numbers identify roles; personal names have not been supplied. Assignment does not mean an implementation has started or passed tests. Existing backlog IDs, priorities, acceptance criteria and unresolved defects remain in force.

All application paths below are relative to `reclaim/`. Each developer uses a separate clone/worktree and their own feature branch. The lead owns final integration/testing and reconciliation of central memory; features enter main through pull requests. This initial documentation publication is the explicitly authorized exception to the feature-PR rule.

| Developer / confirmed scope | Required branch | Owned application boundaries | Existing backlog alignment / first work |
| --- | --- | --- | --- |
| Developer 1 — project lead; student experience, information-response student UI, drop-off guidance, student polish, final integration/testing | `feature/student-experience` | `app/student/`, `app/login/`, `app/signup/`, `components/AuthForm.tsx`, student branches/dialogs of `components/portal/Portal.tsx`, `useWorkspace.ts`, `EditLostReport.tsx`, `components/DeleteReportAction.tsx`, `services/sessionService.ts`; student adapter functions in workspaceService; proposed safe drop-off read endpoint once contract approved | MAG-003/004 drop-off contract/guidance, MAG-005 student response, MAG-006 deployment/integration, MAG-012 student refresh, MAG-014/015 checks/E2E, MAG-022 central memory. Start MAG-005 while coordinating the drop-off contract |
| Developer 2 — admin experience, claim lifecycle/recovery, terminal returned-state protection, information-request administration, expired pickup workflows | `feature/admin-recovery` | `components/admin/`, `app/admin/`, `app/api/admin/`, `lib/server/adminRepository.ts`; approved new recovery SQL migration/function replacements; recovery-specific tests | MAG-008 terminal-state defect first, MAG-009 expired passes, MAG-017 staff intake retries, MAG-021 staff UX; staff side of MAG-005 information-request/response contract |
| Developer 3 — matching engine, compatibility contract, brand/model/color normalization, hard contradiction filtering, similarity ranking and matching-specific tests | `feature/matching-engine` | `services/matchingService.ts`, `services/imageAnalysisService.ts` only within agreed matching scope, matching-specific tests; approved new SQL definitions of match_text/refresh_report_matches/reports_match; `memory/AI_MATCHING.md` when coordinated with the lead | MAG-001 contract first, then MAG-002 contradiction filtering and MAG-007 ranking/lifecycle/parity. MAG-011 remains a planned model/privacy proposal, not authorization to activate a provider |

Developer 3 is **not** the default owner of all backend, auth, database or infrastructure files. Developer 2's recovery SQL and Developer 1's student/drop-off interfaces require shared-contract review, not reassignment of their product scope. Developer 2 must not modify student UI, and Developer 3 must not change staff/student screens or recovery policy to make matcher tests pass. Developer 1 must not implement staff recovery or matcher changes while integrating without coordinating with the assigned owner.

Some existing tasks span scopes: MAG-005 has student UI owned by Developer 1 and information-request administration owned by Developer 2; agree the boundary in both logs before production contract changes. Other broad backlog tasks remain unassigned until the lead records an explicit scoped owner. No task is newly marked implemented or Done by this setup.

## Per-developer update logs and central memory ownership

- [Developer 1 log](team-updates/developer-1.md): edited only by Developer 1.
- [Developer 2 log](team-updates/developer-2.md): edited only by Developer 2.
- [Developer 3 log](team-updates/developer-3.md): edited only by Developer 3.

The setup task initializes these three files; after initialization no developer edits another developer's log, including the lead. Each owner records dated task/branch/commit/PR updates, touched files, tests, dependencies, proposed API/schema changes, conflicts and unresolved issues in their own log. Update the log in the same feature commit/PR as the corresponding work. Read **all three logs** at session start and before integration.

**Developer 1 alone reconciles `CHANGELOG.md`, `CURRENT_STATUS.md` and `TASK_BACKLOG.md` during integration.** Developers 2 and 3 must not concurrently edit these central files to satisfy older completion instructions; their own logs supply the evidence and proposed status changes. This rule supersedes the earlier all-developers-edit-central-files guidance. The lead also coordinates changes to TEAM_COORDINATION, the memory index, API_CONTRACTS, DATABASE and root AGENTS. Feature-specific memory edits need an agreed owner if another branch touches the same document.

Shared production contract changes must first be proposed in the author's own log: old/new shape or behavior, affected consumers/files, dependencies, migration/deployment order, tests and required reviewers. Obtain coordination before changing shared interfaces; logging a proposal is not approval. The lead reconciles accepted contracts into central documents before dependent changes merge. Commit history and PRs remain authoritative evidence; a log does not claim remote publication without Git confirmation.

## Required startup procedure

1. Run `git status`, `git branch --show-current`, `git rev-parse --show-toplevel` and inspect the branch's upstream/local diff. Read repository-root AGENTS.md.
2. Pull the developer's own branch safely: when clean with the correct upstream, `git pull --ff-only`. Never automatically stash, reset, discard or overwrite changes. If dirty or divergent, preserve work and investigate first.
3. `git fetch origin`, review recent changes from `origin/main`, then integrate relevant main changes into the feature branch with a normal merge when clean (`git merge origin/main`). Conflicts require review of both authors' intent. Do not force-push or rebase another developer's published history.
4. Read memory README, CURRENT_STATUS, TEAM_COORDINATION, CHANGELOG and all three developer logs, then the relevant feature docs, API_CONTRACTS and DATABASE.
5. Confirm the task is not already implemented or in progress elsewhere; check dependencies and file ownership. Use only the assigned branch and owned task scope; coordinate shared files/contracts in the personal log before edits.
6. Implement only after the relevant prerequisites/review are satisfied. Separate clones/worktrees are required for truly concurrent branch/index/build operations; three sessions in one physical checkout do not provide isolation.

## Git, branches and integration

Use exactly `feature/student-experience`, `feature/admin-recovery` and `feature/matching-engine` for the assigned workstreams. Do not switch the shared publication checkout away from main on a teammate's behalf. At first use, fetch and create a local tracking branch from its remote in a separate clone/worktree. If a named remote branch already exists, preserve its history and integrate origin/main; never overwrite it with the setup commit.

Every developer commits and pushes to **their own feature branch**, then opens a focused PR to main. Before pushing, inspect `git diff --cached --name-only` and staged content; include only owned application changes and the author's update log/approved documentation. Never stage environment files, credentials or build artifacts. Use `git push -u origin <assigned-branch>` initially, then ordinary non-force pushes.

The lead reviews and merges PRs, integrates shared contracts/migrations, reconciles central status/backlog/changelog and runs final combined tests. Do not have all three developers directly commit/push feature changes to main. Main branch protection/CI is not configured by this documentation task; explicit workflow discipline is required until a separate approved setup adds enforcement.

Before integration, fetch main and each relevant feature branch, read all three logs and PR diffs, check dependency order and rerun the combined checks. A PR blocked by an interface dependency stays open rather than claiming completion. After merge, teammates fetch and merge origin/main safely into their own clean branches; no force/reset shortcut.

Use separate ignored MAGPIE_NEXT_DIST_DIR outputs when build directories could overlap. Never stop another developer's server to claim port 3000; use the actual alternate URL printed by Next.

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
| Central memory: CURRENT_STATUS, TASK_BACKLOG, CHANGELOG, API_CONTRACTS, DATABASE and coordination/index | Concurrent edits would conflict or contradict evidence | Developers 2/3 propose changes in their own logs; Developer 1 reconciles central files at integration. Coordinate shared contracts before production edits |
| `memory/team-updates/developer-1.md`, `developer-2.md`, `developer-3.md` | Independent progress/evidence channels | Each developer edits only their corresponding log; read all three before starting |

Shared UI isolation may be useful later (for example splitting named student dialogs or staff panels), but that is a separately scoped refactor after routes/props are agreed. Do not begin a large component split while three feature branches edit the same file.

## Contracts needed before parallel consumers

1. MAG-001 compatibility decisions, score/label meaning, unknown values and SQL/TS responsibility.
2. MAG-003 active-zone read payload, auth/privacy whitelist and adapter shape.
3. MAG-008 terminal report/competing claim policy, errors, notices and required SQL locks (Developer 2; matching implications reviewed with Developer 3).
4. MAG-005 answer resubmission versus correspondence semantics; agree which evidence the staff screen reads.
5. MAG-009 expiry/reissue contract and old-code invalidation before either portal adds controls.
6. Any pagination/error-code/AI change must define typed DTOs and backward/forward rollout. Admin workspace currently mixes camelCase report views with snake_case collections.

A blocked consumer may work on pure view/error states or a reviewed interface mock in tests, but must not ship an invented backend success fallback.

## Database changes

Document the migration proposal/reservation in the author’s personal log and coordinate it with the lead before creating it. Existing files 001–003 are published history; prefer new additive/idempotent migrations for new behavior. Since the runner replays old SQL, a new function replacement must sort after older definitions and be tested by replaying the whole directory. Migration numbering, not the branch's merge time, determines the resulting function. Keep competing feature migrations focused and verify combined order. Preparation reserves **004 for Developer 2 recovery work** and **005 for Developer 3 matching work**; no such SQL file is created or applied in this step. The lead must coordinate any changed ordering or additional migration before implementation. Never edit the published 001–003 files independently on both feature branches.

Use isolated local/PGlite or per-branch Neon databases when possible. Never point destructive tests at a shared/live database. Identify who applies a reviewed migration, which environment/backup is affected, expected locks/backfill, rollback/forward-fix plan and which application versions remain compatible. No schema/credential changes are part of this documentation task.

## Breaking changes and communication

Before an incompatible API/schema/shared-component change, record a short change note with task/branch, old/new contract, affected consumers/files, migration and deployment order, rollback plan and required reviewers. Notify teammates through the agreed human channel or PR; this document does not authorize agents to send external messages. Prefer additive contracts so old clients and previews can coexist during integration. Feature updates/proposals belong in the author’s personal log and PR so all three can review them, not just one local Codex chat.

## PR and integration procedure

1. Keep the PR focused; lead with the trigger/problem and final behavior, not conversation history.
2. Include source/API/schema changes, privacy implications, tests, manual checks and known limits. Link task ID and affected memory docs.
3. Run relevant tests, typecheck and production build for application changes. Add meaningful regression cases for actual defects; no tests merely mirroring trivial documentation edits.
4. Obtain the affected module owner's review; shared auth/schema/photo changes require the counterpart reviewer even if only one source file changed.
5. Integrator checks current main, combined migration order/contracts and green checks, resolves overlaps with both authors, then merges according to repository policy. Do not assume branch protection or GitHub Actions is already configured.
6. Each teammate synchronizes cleanly after merge and validates their dependent workflow. The lead records merged commit/PR and status/evidence in central memory; authors retain their own log history.

Resolve conflicts by understanding both intended behaviors, not choosing one whole-file version. Re-run relevant suites on the combined result; preserve teammates' unrelated changes. If an ownership/dependency conflict cannot be safely resolved, stop that overlapping edit and coordinate; continue independent documentation/tests if useful.

## Required completion procedure

Each developer runs relevant tests, typecheck/build for application changes, records exact files/behavior/test outcomes/contracts/unresolved issues in **their own update log**, commits and pushes their feature branch, and opens/updates a PR. Developers 2/3 do not edit the lead's central status/backlog/changelog. Developer 1 reconciles those files and accepted shared contracts during integration, marks tasks Done only with implementation/test evidence, and runs combined testing. Preserve historical facts and do not commit secrets or unrelated work.

For this documentation-only publication, verify Markdown links, scope and staged credential scans; application behavior remains unchanged. No application task is completed by assigning ownership or creating branches/logs.

## Confirmed assignment register

| Scope / backlog IDs | Owner | Branch | Update log | State |
| --- | --- | --- | --- | --- |
| Student/UI/drop-off MAG-003/004/005; student refresh MAG-012; lead integration MAG-006/014/015/022 | Developer 1 | feature/student-experience | team-updates/developer-1.md | Assigned; implementation not started by setup |
| Staff/recovery MAG-008/009/017/021; administration counterpart of MAG-005 | Developer 2 | feature/admin-recovery | team-updates/developer-2.md | Assigned; MAG-008 before dependent expiry changes |
| Matching MAG-001/002/007; planned MAG-011 proposal | Developer 3 | feature/matching-engine | team-updates/developer-3.md | Assigned; MAG-001 contract before dependent filtering/ranking |

Remaining cross-cutting backlog items are not automatically assigned. Scope changes, takeover of another developer's files and new shared-interface work require explicit coordination recorded by the owners and reconciled by the lead. A reserved branch/migration is preparation, not evidence of implementation.
