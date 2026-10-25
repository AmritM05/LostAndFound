# Verified project changelog

Dates below come from Git author timestamps shown in America/New_York offset. Commit messages are preserved as evidence, not inferred product milestones. For exact historical diffs use `git show <commit>` from the repository root. Later source supersedes earlier release descriptions.

## 2026-10-24 — repository history

| Local author time | Commit / message | Evidence-backed scope |
| --- | --- | --- |
| 18:54:06 -04:00 | `3fa2cb6` — changes | Added historical preview screenshots and a tracked desktop metadata file; does not itself establish application behavior |
| 18:57:10 -04:00 | `6f1d51a` — Add Magpie app | Added the reclaim entry in the repository; inspect Git object history before assuming source history from the message |
| 18:58:23 -04:00 | `76dcf6c` — Add Magpie project files | Added tracked Next application/server files, configuration, README and retained historical SQL/tests; baseline for subsequent fixes |
| 19:46:01 -04:00 | `4333bea` — fixes | Shared HEIC/25 MB upload refinement, report deletion confirmation/API, migration 002 active-recovery guard and Blob cleanup jobs/retry/tests |
| 20:15:10 -04:00 | `6bf17fd` — fixes pt1 | Central origin/service diagnostics; separate admin pages/auth/APIs; migration 003 found intake, matching/claims/pickup/activity; explicit image workspace roles; active backend/origin tests and setup documentation |

Earlier README/session reports describe successful local/live synthetic checks; see VERIFICATION for their scope and distinction from fresh checks. These commits do not prove that a compatible current Next.js deployment exists.

## 2026-10-24 — initial memory creation (before publication)

- Inspected clean main/upstream/root/remotes, safely ran fast-forward-only pull; remote already current at `6bf17fd`.
- Created application-root memory index, overview, architecture, feature inventory, database/API/security/matching/design/setup docs, current and historical issue list, prioritized backlog, preliminary team split, current-status snapshot and verification ledger.
- Added a repository-root agent startup pointer to the memory procedure. No runtime application logic, database schema, service provider, styling or environment file changed.
- Re-ran the existing 60-test suite and TypeScript successfully. Audited route/schema/test source rather than treating placeholders or archived Supabase tests as current Neon implementation.
- Reproduced a contradictory-brand candidate score above threshold in the reference helper and a returned-lost-report reopening through a second pending claim in isolated PGlite. Recorded these as unresolved defects; did not fix them in this documentation-only task.
- Identified disconnected student zone guidance, partial information-response/expiry flows, refresh/campus/operations gaps and unused old staff adapters.
- Initial task ownership remains unassigned. Documentation validation results belong in VERIFICATION; no automatic commit or push is performed by this task.

## 2026-10-24 — shared publication and confirmed collaboration setup

- Published the initial 17 documentation files to origin/main as `a02d102` (`docs: establish Magpie project memory and team coordination`); Git push succeeded and the remote main SHA was verified.
- Recorded the user-confirmed Developer 1 student/integration, Developer 2 admin/recovery and Developer 3 matching scopes with their exact feature branch names. No application implementation was marked complete.
- Initialized three exclusive-writer logs under team-updates. Developers 2/3 record progress and shared-contract proposals in their own logs; Developer 1 reconciles central status/backlog/changelog during integration.
- Updated root AGENTS and memory startup/completion rules to avoid concurrent central-file edits; features use isolated branches/worktrees and PRs to main.
- Reserved future migration numbers 004 (Developer 2 recovery) and 005 (Developer 3 matching) for coordination only; no schema file was created or applied.
- This setup changes documentation only. Publication of this second setup change is confirmed by the execution report after Git push, rather than assumed from a local edit. Existing feature branches, if any, are preserved and must integrate main before dependent work.

## Rules for future entries

Developers append actual dated evidence/proposals to their own team update logs. Developer 1 alone reconciles dated central entries here during integration, including task, commit/PR or explicit uncommitted status, changed behavior/contracts/schema, scoped tests and unresolved limitations. Preserve previous entries; annotate corrections with source evidence. Never invent implementation dates from a UI screenshot or assume a test against archived SQL proves the active runtime.
