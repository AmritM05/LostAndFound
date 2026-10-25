# Current status — start every coding session here

**Snapshot:** 2026-10-24, inspected baseline `6bf17fd` on main, synchronized with origin/main. The memory system is a documentation-only addition pending review/commit. Re-read Git status/recent teammate changes before assuming this snapshot is current. No accepted developer ownership claims exist yet.

## What works, with evidence limits

The current code supports separate student email-demo and staff credential sessions; student lost reporting with optional building/map/unknown location, private original photos/HEIC/25 MB policy, owned reports/editing/eligible deletion; safe found Search; staff zone management and private found intake; automatic heuristic matching; private claims/updates/notes; staff decisions and single-use pickup/return. Active Neon/PGlite and API/helper tests are present; the existing suite passes **60 tests** and TypeScript passes in this memory task.

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

## Next work for three developers — preliminary

- **Developer 1 / lead, student area:** MAG-005 information-response UX can start against existing APIs; coordinate MAG-006 hosting and consume MAG-003 zone contract in MAG-004.
- **Developer 2 / staff area:** MAG-008 terminal-state regression and guarded claim transitions, reserving a focused migration with the DB integrator. Staff list/expiry UX follows the agreed transition contract.
- **Developer 3 / backend/matching:** MAG-001 compatibility contract and MAG-002 active SQL/helper regression; provide MAG-003 safe zone read projection to unblock student guidance.

These are suggestions, not assignments. Claim tasks/branches and shared files in [TEAM_COORDINATION](TEAM_COORDINATION.md) before coding. No new application feature is implemented by this memory task.

## Largest integration risks

`Portal.tsx` and `AdminPortal.tsx` are large shared editing surfaces; global CSS, shared ReportForm/photo/maps, types/validation, auth/origin helpers and migration functions couple workstreams. The migration runner replays files by numeric name, so conflicting function replacements can silently supersede one another. Admin DTO casing differs from student DTOs. Some tests exercise archived Supabase rather than active Neon. Shared physical checkouts and build directories can overwrite concurrent work. Read [API_CONTRACTS](API_CONTRACTS.md), [DATABASE](DATABASE.md) and [TASK_BACKLOG](TASK_BACKLOG.md) before implementation.

## Update this snapshot when completing a task

State the new source/commit, task status, exact verification and unresolved issues. Update feature/contract/schema documents and CHANGELOG together; never declare Done based on a button, local fake data or an unverified deployment.
