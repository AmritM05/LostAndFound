# Prioritized task backlog

Baseline 2026-10-24, source `6bf17fd`. Task definitions remain unchanged; selected ownership assignments are now confirmed in TEAM_COORDINATION. Assignment is not implementation or completion. Developers record progress/evidence in their own logs; Developer 1 alone reconciles this central backlog during integration. Ready means no known prerequisite prevents starting; Blocked means a dependency must be resolved first. Complexity: Small / Medium / Large. P0 is necessary for a trustworthy hackathon demonstration; P1 important functionality; P2 polish/optional. Do not fix tasks during this documentation-only phase.

Each task records description, status/priority/complexity, dependencies, likely files, ownership area, acceptance criteria and testing requirements. Move a task to Done only with commit/PR and scoped verification evidence.

## P0 — demonstration reliability

### MAG-001 — Agree the two-stage matching contract

- **Confirmed owner:** Developer 3; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Ready, assigned Developer 3 / P0 / Small.
- **Description:** Define canonical category/type/brand/model/color/identifier values, unknown/provenance rules, contradiction decisions, available-factor weighting, labels and compatibility between SQL/TypeScript/UI. Confirm which target ranking signals are feasible without AI.
- **Dependencies / proposed area:** Team product agreement; backend/matching developer with both UI reviewers.
- **Likely files:** `memory/AI_MATCHING.md`, `API_CONTRACTS.md`, `TEAM_COORDINATION.md`; proposed shared matcher types require review before code.
- **Acceptance:** Written contradiction/missing-data examples and versioned rollout plan approved; no claim that a model is integrated or weights changed merely by documentation.
- **Tests:** Enumerate Apple/Samsung, Nike/Adidas, incompatible colors, unknown fields, location/time ranking and private evidence cases before implementation.

### MAG-002 — Implement contradiction-first candidate filtering

- **Confirmed owner:** Developer 3; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Blocked by MAG-001, assigned Developer 3 / P0 / Large.
- **Description:** Add hard rejection for confirmed high-confidence contradictions before scoring; align active SQL matcher with TS helper and preserve unknown data as non-rejection. Fix K-01.
- **Dependencies / proposed area:** MAG-001; backend/matching, coordinated migration review.
- **Likely files:** `services/matchingService.ts`, a new `db/migrations/` file replacing relevant functions/trigger policy, `services/matchingService.test.ts`, `services/adminBackend.test.ts`.
- **Acceptance:** AirPods/Galaxy Buds, confirmed Nike/Adidas and incompatible confirmed colors never persist as candidates. Missing/ambiguous attributes do not eliminate otherwise compatible candidates. Notices only generated for qualifying pairs.
- **Tests:** Pure compatibility table tests plus actual migration/PGlite persistence tests, SQL/TS parity, privacy and idempotent upgrade cases.

### MAG-003 — Expose a privacy-safe active drop-off read contract

- **Confirmed owner:** Developer 1; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Ready for contract review, assigned Developer 1 / P0 / Small.
- **Description:** Add a safe read projection/API for approved active desks, separate from building data. Current listDropoffZones is a stub. Agree fields/auth/cache policy before frontend work.
- **Dependencies / proposed area:** Agreement in API_CONTRACTS; backend/API owner, student reviewer. Existing zones/buildings schema can be reused.
- **Likely files:** Proposed `app/api/dropoffs/route.ts`, server repository/projection tests, `memory/API_CONTRACTS.md`.
- **Acceptance:** Active desks return only approved public fields; inactive desks and staff notes/private item information never leak; no new duplicate zone table.
- **Tests:** Active/inactive zones, empty database, building mapping, allowed response keys and authorization/cache behavior.

### MAG-004 — Connect student drop-off guidance and correct empty copy

- **Confirmed owner:** Developer 1; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Blocked by MAG-003, assigned Developer 1 / P0 / Small.
- **Description:** Wire listDropoffZones to the agreed read API and show real desks/instructions on the student map page. Distinguish buildings from staffed intake; fix K-02.
- **Dependencies / proposed area:** MAG-003 accepted payload; student UI developer with shared map coordination.
- **Likely files:** `services/workspaceService.ts`, `components/portal/Portal.tsx`; shared CampusMap only if explicitly needed/agreed.
- **Acceptance:** Staff-created active desk appears to students; inactive desk disappears on refresh; failure versus empty states are truthful; unknown location remains optional.
- **Tests:** Read-adapter integration, narrow/desktop UI, configured campus, empty/error states and public-data privacy.

### MAG-006 — Establish and verify the actual server deployment

- **Confirmed owner:** Developer 1; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Open; hosting choice/access and environment verification pending / P0 / Medium.
- **Description:** Project lead selects compatible Next.js hosting, assigns preview/production databases and private Blob stores, controls secrets/referrers and performs a complete synthetic hosted smoke test. Do not republish old static out as this app.
- **Dependencies / proposed area:** Hosting/account access, approved migrations, server variables, active zone; project lead/integration with both portal owners. Resolve MAG-008 before demonstrating multiple claims.
- **Likely files:** Deployment configuration only if agreed, `README.md`, memory setup/status/verification; secret values remain outside Git.
- **Acceptance:** Actual URL runs student/admin authentication, persistence, private upload (including large HEIC), safe search, matching, claim/pickup/delete without origin errors; unrelated student access denied. Audience/access unchanged unless explicitly authorized.
- **Tests:** Build/typecheck/test plus preview/production Origin and auth matrix, private image direct-access denial, migration health and scoped synthetic cleanup.

### MAG-008 — Guard terminal recoveries and stale competing claim decisions

- **Confirmed owner:** Developer 2; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Ready for policy/SQL coordination, assigned Developer 2 / P0 / Medium.
- **Description:** Fix K-03: returned/archived lost reports must not reopen through a pending claim on another found report. Define competing claims/matches cleanup/closure and notices; enforce both reports' terminal states under locks.
- **Dependencies / proposed area:** Admin recovery-state agreement; staff workflow developer with database integrator review. Reserve a distinct migration filename before edits.
- **Likely files:** New migration replacing `review_ownership_claim` and related transitions, `services/adminBackend.test.ts`, admin action/UI only as needed.
- **Acceptance:** Reproduction from KNOWN_BUGS rejects second approval without changing Returned records or issuing another pass; existing approved and rejected flows stay valid; users receive appropriate private updates.
- **Tests:** One lost/two found/two pending claims; return first then approve second; archived lost/found cases; stale decisions, duplicate assignment and concurrent tests where feasible; upgrade replay.

## P1 — important recovery and integration work

### MAG-005 — Complete the student more-information response loop

- **Confirmed owner:** Developer 1; implementation remains open. Developer 2 owns the administration counterpart; shared contract changes require coordination.
- **Status / priority / complexity:** Ready, assigned Developer 1 / P1 / Medium.
- **Description:** Present More information claims with actionable private answer resubmission or an explicitly agreed notes workflow. Use the existing resubmission API where appropriate, and make staff evidence/state clear.
- **Dependencies / proposed area:** Existing claim/notes contracts; student developer with staff reviewer. No new endpoint assumed.
- **Likely files:** `components/portal/Portal.tsx`, workspaceService if required; admin evidence rendering only with staff owner agreement.
- **Acceptance:** Student sees what is requested, can respond, understands status, and staff can review the response. No found-item identifying evidence revealed. Pending/Approved/Returned claims don't show inappropriate resubmit controls.
- **Tests:** Browser information-request→response→review cycle, empty/oversized answers, owner isolation, existing API transition tests.

### MAG-007 — Make matcher lifecycle, parity and concurrency explicit

- **Confirmed owner:** Developer 3; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Blocked by MAG-001 contract; investigation may start / P1 / Large.
- **Description:** Address dismissed-pair reactivation, stale claimed pairs, update/close behavior, simultaneous inserts, score-version/backfill needs and SQL/TS divergence. Improve candidate retrieval before scaling.
- **Dependencies / proposed area:** MAG-001/002 policies, database review; backend/matching.
- **Likely files:** New matching migration, matchingService, matcher regression tests, AI_MATCHING.
- **Acceptance:** Documented deterministic lifecycle and migration/backfill path; no duplicate notices or missing final pair under supported concurrency; equivalent inputs have equivalent results or documented tolerances.
- **Tests:** Boundary values, time direction/rounding, missing location/text, dismissal→improved match, updates with claims, closed reports, concurrent lost/found creation and repeated upgrade.

### MAG-009 — Reissue/revoke expired pickup passes safely

- **Confirmed owner:** Developer 2; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Blocked on recovery-state contract/MAG-008, assigned Developer 2 / P1 / Medium.
- **Description:** Define a protected replacement-pass transition and UI for expired approvals, invalidating old credentials and recording activity/notices.
- **Dependencies / proposed area:** MAG-008, reviewed new API/function contract; staff workflow with DB reviewer and student pass consumer.
- **Likely files:** Admin actions, new migration, AdminPortal, student pass dialog, owner projection.
- **Acceptance:** Valid staff can reissue without duplicate assignment; old/used/revoked code fails; student sees current expiration/location/code; no blank QR pass.
- **Tests:** Expiry, reissue, reuse, concurrent redemption, permission denial, private display projection.

### MAG-010 — Finish configurable single-campus behavior

- **Status / priority / complexity:** Ready for scope agreement, unassigned / P1 / Medium.
- **Description:** Remove hardcoded staff campus adaptation; define dataset-switch/seed semantics and make email-domain intent explicit. Do not quietly add multi-tenant claims.
- **Dependencies / proposed area:** Shared campus/schema contract; student/config area, staff and DB reviewers.
- **Likely files:** `lib/campus.ts`, AdminPortal, migrate script, campus tests/docs.
- **Acceptance:** A second synthetic campus works consistently across branding/buildings/zones; stale buildings handled by agreed safe migration; login policy truthfully described.
- **Tests:** Config parse, invalid points, seed transitions, active-zone projection, both portal forms, no accidental deletion of existing reports.

### MAG-012 — Refresh private state after remote staff changes

- **Confirmed owner:** Developer 1; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Ready for refresh policy agreement, assigned Developer 1 / P1 / Medium.
- **Description:** Add a bounded refresh/focus/poll strategy or approved push approach; prevent selected-dialog stale state and misleading identity loss on transient failures.
- **Dependencies / proposed area:** Current workspace APIs; student owner and staff reviewer, no new notification provider presumed.
- **Likely files:** useWorkspace, Portal, AdminPortal, apiClient if errors require typed status.
- **Acceptance:** Student sees staff information/approval/return changes within documented latency, without page navigation; transient errors remain visible without invented empty-success state; no excessive requests.
- **Tests:** Two-session browser flow, expired sessions, races/unmount, temporary service errors and request-frequency bounds.

### MAG-013 — Operate report-photo cleanup reliably

- **Status / priority / complexity:** Ready, unassigned / P1 / Medium.
- **Description:** Define retry scheduling, abandoned reservation cleanup, ownership/age boundaries and retention. Preserve transactional outbox for committed deletes.
- **Dependencies / proposed area:** Deployment runner, storage retention decision; backend/operations.
- **Likely files:** blobCleanup, cleanup-blobs, new reviewed cleanup script/job config and tests; schema changes only if justified.
- **Acceptance:** Failed cleanup retries safely, abandoned originals/previews eventually removed, associated active photos preserved, diagnostics redacted and bounded.
- **Tests:** Failure/retry/idempotence, interruption, incomplete uploads, shared/unrelated paths, batch limits and no secret leakage.

### MAG-014 — Add CI for active application checks

- **Confirmed owner:** Developer 1; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Ready, assigned Developer 1 / P1 / Small.
- **Description:** Add reviewed GitHub workflow for install/typecheck/test/build with synthetic/no service credentials. Separate archived and active coverage in reports.
- **Dependencies / proposed area:** Repository permissions/branch protection agreement; lead/integration, test owners review.
- **Likely files:** Proposed root `.github/workflows/` file, package scripts only if needed, VERIFICATION.
- **Acceptance:** PRs report reproducible Node/npm checks from reclaim, no production migrations/secret access, clear failure output and appropriate generated-file handling.
- **Tests:** Run workflow on a feature PR, verify failure detection and no secret-dependent runtime calls during build/tests.

### MAG-015 — Commit repeatable browser recovery/privacy tests

- **Confirmed owner:** Developer 1; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Open; test-environment strategy required / P1 / Large.
- **Description:** Add a maintained E2E harness for both portals, mixed sessions, private images, deletion, matching, claims and pickup. Avoid a hidden runtime fake-success fallback.
- **Dependencies / proposed area:** MAG-008 and agreed isolated backend/storage strategy; integration/testing with all owners.
- **Likely files:** Proposed E2E tests/config; package dev tooling only when chosen, active fixtures, CI integration.
- **Acceptance:** One documented command tests core UI and denial paths on explicitly disposable data; cannot accidentally mutate production; cleanup verified.
- **Tests:** Actual browser flows, alternate local port, staff-email student session, large image boundary, map-unavailable fallback, active deletion denial, expired/stale claim states.

### MAG-017 — Make found intake retry-safe

- **Confirmed owner:** Developer 2; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Ready for contract agreement, assigned Developer 2 / P1 / Medium.
- **Description:** Reproduce lost-response duplicate intake and define stable request/report ID semantics before extending the SQL function and form retry behavior.
- **Dependencies / proposed area:** Staff form and server contract agreement; staff developer, DB reviewer.
- **Likely files:** ReportForm, admin reports API/repository, new save_found_report migration, tests.
- **Acceptance:** Retry of the same authorized intake returns the same record and photo associations; unrelated IDs remain protected; no duplicate inventory on response loss.
- **Tests:** Network-response loss, repeated submit with/without photos, foreign ID, changed payload and transaction rollback.

### MAG-018 — Normalize validation and service error diagnostics

- **Status / priority / complexity:** Ready, unassigned / P1 / Medium.
- **Description:** Validate object JSON shapes consistently, preserve safe distinction of constraint/business/connection/storage failures and agree typed error codes without breaking consumers.
- **Dependencies / proposed area:** API contract review; backend/API, both consumer reviewers.
- **Likely files:** http, diagnostics, db, validation, apiClient, Route Handlers as needed.
- **Acceptance:** Malformed/null/wrong-shape inputs return 400-class errors rather than fake connection failures; origin/auth remain distinct; no secrets or report bodies logged.
- **Tests:** Invalid JSON/null/arrays, length/date/UUID errors, duplicate constraints, absent config, storage failure, redaction assertions.

## P2 — optional/polish and pre-production planning

### MAG-011 — Specify real AI/semantic matching integration

- **Confirmed owner:** Developer 3; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Planned; provider/privacy/cost decision pending / P2 / Large.
- **Description:** Evaluate an image/semantic extraction or embedding approach only after compatibility/fallback contracts, with explicit approved data handling and measured usefulness.
- **Dependencies / proposed area:** MAG-001/002/007, team privacy/provider approval; backend/matching.
- **Likely files:** imageAnalysisService, new provider adapter/tests, server-only env names, reviewed embedding/model-version schema and jobs if needed.
- **Acceptance:** Named model/provider and processing purpose documented; no fabricated outputs; reliable confidence/failure fallback, versioned evidence and human verification remain. No key invented or private images sent without agreed scope.
- **Tests:** Labelled synthetic/authorized dataset, contradictions and missing images, timeout/rate/cost behavior, provider failure, privacy and non-owner responses.

### MAG-016 — Retire inactive staff code and clarify legacy tests

- **Status / priority / complexity:** Ready after owner coordination, unassigned / P2 / Medium.
- **Description:** Deprecate/remove unreachable Portal admin/statistics/DropoffZones and throwing adapters; separate historical Supabase suites from active runtime assertions.
- **Dependencies / proposed area:** Both portal owners confirm route usage; lead integration.
- **Likely files:** Portal, DropoffZones, workspaceService, legacy tests/scripts/docs.
- **Acceptance:** Active behavior unchanged, no orphan imports/routes, no false test coverage claims; legacy rationale retained or removed intentionally.
- **Tests:** Route inventory, build/typecheck, all active workflow/privacy tests, student visual regression.

### MAG-019 — Harden image lifecycle/content handling

- **Status / priority / complexity:** Planned, unassigned / P2 / Medium.
- **Description:** Review pixel-count/memory limits, metadata validation, MIME/content mismatches, preview observability and accessibility; preserve original HEIC support.
- **Dependencies / proposed area:** Storage/privacy contract; shared photo owner with portal reviewers.
- **Likely files:** uploadConfig, imagePreview, PhotoUploader, image routes/storageService, tests.
- **Acceptance:** Valid supported 25 MB originals remain accepted; unsupported/corrupt inputs fail safely; no unsafe public previews; timeouts and memory bounds documented.
- **Tests:** Real codecs, sequence/blank/wrong MIME, large dimensions, exact size boundary, object URL cleanup and retry paths.

### MAG-020 — Plan production identity and security controls

- **Status / priority / complexity:** Planned; production use decision required / P2 / Large.
- **Description:** Replace unverified email demo and shared admin credential model before real private use; define staff identity, tenant/desk access, rate limiting, session revocation and retention.
- **Dependencies / proposed area:** Product/security review; lead/backend. Do not change providers during unrelated tasks.
- **Likely files:** session/adminSession, auth pages/APIs, schema, security tests/docs; actual provider not selected.
- **Acceptance:** Verified ownership/account access and scoped staff authorization; transition/backfill plan; no private real-world data under email impersonation.
- **Tests:** Auth/access threat model, role/email collision, cross-user/tenant/image denials, session expiry/revocation, production-origin matrix.

### MAG-021 — Staff list scale, filter and accessibility polish

- **Confirmed owner:** Developer 2; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Ready for scoped UI work, server paging contract pending / P2 / Medium.
- **Description:** Improve pending/returned queue filters, empty states, date range, table responsiveness, dialog focus return and long-list behavior; add pagination only through agreed API contracts.
- **Dependencies / proposed area:** Staff UI; shared CSS reviewer; MAG-018 if typed errors used.
- **Likely files:** AdminPortal, adminRepository/APIs for reviewed paging, app/globals.css staff section, tests.
- **Acceptance:** Long and empty lists remain understandable; no private data fetched through public endpoints; keyboard/mobile/desktop behavior verified.
- **Tests:** Zero/many/filter-no-result states, dates/time zones, keyboard focus, narrow viewport and authorization regression.

### MAG-022 — Keep this memory system current

- **Confirmed owner:** Developer 1; implementation remains open. See TEAM_COORDINATION for branch/file boundaries.
- **Status / priority / complexity:** Ongoing; initial documentation created in this task / P1 / Small per change.
- **Description:** Collect each developer’s own log evidence for every feature PR; the lead reconciles central source/evidence/contracts/backlog/status and maintains the startup pointer/assignment register.
- **Dependencies / proposed area:** Every developer owns their own log; Developer 1 reconciles central files and verifies completion.
- **Likely files:** affected memory documents and repository-root AGENTS.md only when its startup procedure changes.
- **Acceptance:** Distinguish current/target/status, no secrets, working links, preserved history and exact verification evidence.
- **Tests:** Markdown file/link/secret scan, current source references and reviewed Git diff; no feature change hidden inside docs PR.


## 2026-10-25 — final integration gate (no tasks promoted to Done)

Lead explicitly requires preparation without feature merges and read-only remote access. MAG-001/002 matching, MAG-008 recovery guards and MAG-009 renewal have reviewed remote implementations with independent tests/pinned SQL audit, but are not integrated/deployed here. MAG-005 student/staff integration, MAG-006 live/deployment readiness and MAG-015 complete live acceptance remain blocked on completion confirmation, authorized merges and an explicitly authorized disposable target. MAG-003 live-zone read API remains absent; MAG-004 retains truthful guidance. The new audit/FINAL_INTEGRATION_PLAN advance preparation and MAG-022 memory reconciliation only. Do not infer main is fixed or a live demonstration is ready from these branch tests.
