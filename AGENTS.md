# Magpie repository startup

The application is in `reclaim/`; package commands run there. Persistent project memory starts at [reclaim/memory/README.md](reclaim/memory/README.md).

Before feature implementation, every developer and coding agent must:

1. Inspect Git status, branch, repository root, upstream, local diffs and recent teammate commits. Preserve other developers' changes. Synchronize clean intended branches safely with fast-forward-only pull; never automatically stash, reset, discard or force-push.
2. Read memory README, CURRENT_STATUS, TEAM_COORDINATION and CHANGELOG, then the relevant feature documents and API contracts.
3. Confirm the task is not already implemented or claimed by another developer; check dependencies, agree shared-file/API/schema changes and use an isolated feature branch/worktree. Use the confirmed feature/student-experience (Developer 1), feature/admin-recovery (Developer 2), or feature/matching-engine (Developer 3) branch for the assigned scope; review all three developer logs and integrate relevant origin/main changes safely.
4. Work within the user's requested scope. Do not introduce application changes during a documentation-only task or change providers/auth/styling as unrelated cleanup.

Before completion, run appropriate checks, update only your own memory/team-updates/developer-N.md log, report exact changes/tests/proposed shared contracts/blockers, and commit/push your feature branch through a PR. Developer 1 alone reconciles central CURRENT_STATUS.md, TASK_BACKLOG.md and CHANGELOG.md during integration; Developers 2/3 must not concurrently edit them or each other’s logs. Coordinate shared production interfaces before modifying them. Treat source plus scoped evidence as authoritative. Never copy secrets or real private item evidence into documentation. Do not automatically push unfinished work.

See [TEAM_COORDINATION.md](reclaim/memory/TEAM_COORDINATION.md) for the full required startup/completion and integration procedure. Shared physical checkouts are not safe isolation for concurrent developers.
