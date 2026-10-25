# Current status — start every coding session here

## Integrated snapshot — 2026-10-25 (supersedes historical baseline below)

All frozen branches are merged into `integration/final-hackathon`: student `a686d21`, admin `3e8b18d`, matching `cefd1c5`. The lead lifted the merge hold. Main remains unchanged and Draft PR #2 remains unmerged. Student drop-off guidance consumes the authenticated published-desk API; staff views show private matching classification/reasoning and ranking indices. Compatible/contradictory/unknown demo scenarios and recovery terminal guards pass local acceptance.

Final verification: **119 automated tests passed, zero failures/skips/TODO**, TypeScript and production build passed; **36 synthetic browser scenarios** passed (16 student recovery/drop-off, 10 intake/deletion/search, 10 staff desktop/mobile). Frozen ordered **001–007** local SQL audit also passes separately (overlaps full-suite coverage). No real photo upload/auth/recovery run occurred. Read-only Neon/Blob checks pass, but 005/006/007 schema markers are missing and recovery bodies differ from 004. **Remote migration writes remain unauthorized; complete live recording is blocked.** See [FINAL_INTEGRATION_PLAN](FINAL_INTEGRATION_PLAN.md), [VERIFICATION](VERIFICATION.md) and [DEMO_RUNBOOK](DEMO_RUNBOOK.md).

### Historical baseline (not current integrated behavior)

**Snapshot:** 2026-10-24, inspected baseline `6bf17fd` on main, synchronized with origin/main. The initial memory system was published to origin/main in `a02d102`. The confirmed ownership/log setup is a subsequent documentation-only update; verify your fetched main includes it before starting. Re-read Git status/recent teammate changes and all three personal logs before assuming this snapshot is current.

## What works, with evidence limits

The current code supports separate student email-demo and staff credential sessions; student lost reporting with optional building/map/unknown location, private original photos/HEIC/25 MB policy, owned reports/editing/eligible deletion; safe found Search; staff zone management and private found intake; automatic heuristic matching; private claims/updates/notes; staff decisions and single-use pickup/return. Active Neon/PGlite and API/helper tests are present; the initial memory audit passed **60 tests** and TypeScript. These application checks were not rerun for the documentation-publication update.

A previous implementation session reported a production build and real Neon/private Blob/browser synthetic recovery checks, including a 25 MB upload and Blob deletion. Those checks are historical, not re-run remote health/deployment certification for this task. See [VERIFICATION](VERIFICATION.md). Existing screenshots are not substitutes for code or current test evidence.

## Confirmed broken or unsafe paths

1. **P0 claim-state defect:** with two pending claims for one lost report, returning through the first then approving the second can reopen the lost report as Ready for Pickup. Fresh isolated migration-function reproduction confirmed this; MAG-008.
2. **P0 matching defect:** no contradiction-first filter. Confirmed Apple/Samsung incompatible earbuds scored 70 against a 60 threshold; MAG-001/002. No AI model is integrated.
3. **P0 student guidance gap:** student listDropoffZones always returns []; actual staff zones never appear in the approved student intake list; MAG-003/004.
4. **Hosted demo readiness unverified:** old static hosting metadata points to out and cannot serve current APIs. Compatible server deployment and hosted smoke tests remain open; MAG-006.

## Unfinished, not wholly missing

More-information API resubmission exists but student UI directs to notes instead; expired pickup passes lack reissue; views are not realtime; campus configuration is not full tenancy; abandoned uploads/manual cleanup, unpaginated staff lists and basic demo auth limit production use. Legacy Portal staff/statistics branches and throwing workspaceService adapters are inactive, while the actual AdminPortal works. Do not rebuild or mark the complete admin implementation missing.

The requested two-stage compatibility + image/semantic weighted matching, selected AI provider/model, embeddings, calibrated labels, CI and maintained browser E2E are **planned**, not implemented. Google map code/loader tests exist, but a new teammate's billing/key/referrer configuration is not verified.

## What can be demonstrated now

On a correctly configured local Next server, migrated Neon/private Blob and active intake desk: create lost/found reports, upload private supported photos, show safe Search, generate a compatible match, submit a private claim, approve and redeem its pass, and delete an eligible lost report. Use synthetic data because student email ownership is unverified. Avoid presenting heuristic percentages as ownership probabilities or the multi-claim state defect as supported behavior. Fix MAG-008 before a multi-claim demo; prepare deployment smoke tests before promising an externally hosted demo.

## Confirmed assignments and next work

| Developer | Branch | Confirmed responsibility | Existing tasks / start |
| --- | --- | --- | --- |
| Developer 1 — project lead | `feature/student-experience` | Student experience, information-response student UI, drop-off guidance, student-facing polish, final integration/testing | MAG-005 first; MAG-003/004 zone contract/guidance, MAG-012 student refresh, MAG-006/014/015 integration/checks. Owns central memory reconciliation (MAG-022) |
| Developer 2 | `feature/admin-recovery` | Admin experience, claim lifecycle/recovery, terminal returned-state protection, information-request administration, expired pickup workflows | MAG-008 first, then MAG-009; staff side of MAG-005, MAG-017/021 staff improvements |
| Developer 3 | `feature/matching-engine` | Compatibility contract, brand/model/color normalization, hard contradictions, similarity ranking and matching-specific tests | MAG-001 first, then MAG-002/007. MAG-011 remains planned; no AI model activated |

Assignments are confirmed, but application implementation/status is unchanged. Read [TEAM_COORDINATION](TEAM_COORDINATION.md) for actual file/function boundaries, approved shared-contract process and migration reservations. Developer 3 does not own all backend/auth/infrastructure merely because matching uses SQL.

Independent update logs: [Developer 1](team-updates/developer-1.md), [Developer 2](team-updates/developer-2.md), [Developer 3](team-updates/developer-3.md). Each author edits only their own log. Developers 2/3 record progress, test evidence, proposed contract changes and blockers there instead of concurrently editing central files. Developer 1 reconciles CURRENT_STATUS, TASK_BACKLOG and CHANGELOG during integration. All feature changes use owned branches and PRs to main.

## Largest integration risks

`Portal.tsx` and `AdminPortal.tsx` are large shared editing surfaces; global CSS, shared ReportForm/photo/maps, types/validation, auth/origin helpers and migration functions couple workstreams. The migration runner replays files by numeric name, so conflicting function replacements can silently supersede one another. Admin DTO casing differs from student DTOs. Some tests exercise archived Supabase rather than active Neon. Shared physical checkouts and build directories can overwrite concurrent work. Read [API_CONTRACTS](API_CONTRACTS.md), [DATABASE](DATABASE.md) and [TASK_BACKLOG](TASK_BACKLOG.md) before implementation.

## Update this snapshot when completing a task

Developers record source/commit/PR, task status, exact verification and unresolved issues in their own personal log. Developer 1 alone reconciles this snapshot, TASK_BACKLOG, CHANGELOG and accepted shared contracts during integration. Never declare Done based on a button, local fake data or an unverified deployment.
