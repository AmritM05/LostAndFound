# Magpie project memory

Magpie is a privacy-first campus lost-and-found application for HackOHI/O 2026. Students describe lost items privately; authorized campus staff receive physical found items, compare reports, verify claims, and complete pickup.

## Scope and evidence

Baseline: Git commit `6bf17fd` on `main`, inspected 2026-10-24 (America/New_York). The clean checkout was synchronized with `git pull --ff-only`; it was already current. Repository: [AmritM05/LostAndFound](https://github.com/AmritM05/LostAndFound). Git root is the parent of this application; **the application root is `reclaim/`, beside `package.json`, not the Git root**. All source paths in these documents are relative to the application root unless explicitly identified otherwise.

This memory records current implementation separately from requirements. Source, tests and actual observations take precedence over old README claims, screenshots, UI labels and this documentation. Verification is scoped in [VERIFICATION.md](VERIFICATION.md). Nothing here certifies production security, deployment readiness or a teammate's credentials.

## Required startup for every developer and coding agent

1. Run `git status`, identify branch, repository root and upstream. Read the working diff before changing files.
2. If clean and tracking the intended remote branch, synchronize with `git pull --ff-only`. Otherwise preserve local work and investigate; never automatically stash, reset, force-pull or overwrite another developer's changes.
3. Read this file, [CURRENT_STATUS.md](CURRENT_STATUS.md), [TEAM_COORDINATION.md](TEAM_COORDINATION.md) and [CHANGELOG.md](CHANGELOG.md).
4. Review recent Git commits, teammate PRs and the current backlog ownership claims.
5. Read relevant feature documents below and [API_CONTRACTS.md](API_CONTRACTS.md).
6. Confirm the task is neither implemented nor already claimed. Check dependencies and shared-file ownership. Use a separate feature branch before implementing code.
7. Only then implement the agreed task. A proposed owner is not an actual assignment.

## Documentation index

| Document | Read it for |
| --- | --- |
| [CURRENT_STATUS.md](CURRENT_STATUS.md) | Session-start snapshot and immediate risks |
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Product requirements and decisions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System boundaries, modules and dependencies |
| [FEATURE_INVENTORY.md](FEATURE_INVENTORY.md) | Implemented, partial, missing and blocked functionality |
| [DATABASE.md](DATABASE.md) | Actual tables, migrations, transactions and gaps |
| [API_CONTRACTS.md](API_CONTRACTS.md) | Current HTTP interfaces and client adapters |
| [AUTH_AND_SECURITY.md](AUTH_AND_SECURITY.md) | Sessions, authorization and privacy limits |
| [AI_MATCHING.md](AI_MATCHING.md) | Current heuristic and proposed two-stage matcher |
| [UI_AND_DESIGN.md](UI_AND_DESIGN.md) | Screens, visual system and design constraints |
| [ENVIRONMENT_AND_SETUP.md](ENVIRONMENT_AND_SETUP.md) | Local tools, variable names, checks and deployment |
| [KNOWN_BUGS.md](KNOWN_BUGS.md) | Confirmed gaps, risks and historical fixes |
| [TASK_BACKLOG.md](TASK_BACKLOG.md) | Prioritized tasks, dependencies and acceptance criteria |
| [TEAM_COORDINATION.md](TEAM_COORDINATION.md) | Preliminary work split and safe integration rules |
| [CHANGELOG.md](CHANGELOG.md) | Evidence-backed project history |
| [VERIFICATION.md](VERIFICATION.md) | What was tested, when and with which limits |

## Completion and maintenance rules

Before completing a task: run appropriate checks; update affected memory documents; mark completed backlog tasks with evidence; refresh CURRENT_STATUS; append a concise CHANGELOG entry; document API/schema changes and consumer impact; report exact changed files and unresolved issues. Keep historical entries intact, adding corrections with evidence instead of rewriting history.

Each update must state date, source/commit or uncommitted scope, status, verification and remaining limitations. Use these exact status meanings: **Implemented and verified**, **Implemented but unverified**, **Partially implemented**, **Planned but not implemented**, **Broken or blocked**. A passing unit test does not imply a deployed workflow works. No secrets or real private item evidence belong in memory, issues, commits or screenshots. Coordinate overlapping document edits just like shared code.

The repository-root `AGENTS.md` points agents here. The existing [application README](../README.md) remains useful for setup; this directory supplies the collaboration and current-state detail.
