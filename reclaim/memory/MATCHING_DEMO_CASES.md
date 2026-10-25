# Matching demo cases and final QA

## Optional Gemini A/B/C demo — 2026-10-25

The previous cases below remain valid deterministic checks. Real Gemini integration is now implemented behind staff-only synthetic-demo confirmation; **no live Gemini cases were run here**, as the user requested push-only for validation on another laptop. Setup and exact opt-in command: [GEMINI_MATCHING](GEMINI_MATCHING.md).

- **A: compatible semantic paraphrase.** Nike/black backpack; lost description `Crimson fabric loop on a nylon rucksack`; found `A red carrying tab on a travel bag`. Mocked SDK-shaped vectors improved the persisted ranking in `geminiPersistence.test.ts`. This is mock-verified pipeline behavior, not a measured real model score. On the recording laptop, choose the pair in staff Matches, confirm synthetic processing, run Gemini and show the actual index/channels. Record whether it improves; do not promise an unmeasured increase.
- **B: brand contradiction.** Same descriptive evidence with Nike versus Adidas, or Apple AirPods versus Samsung Galaxy Buds. Remains NO MATCH before any provider/image call; direct SQL also rejects even synthetic signals of 1. No actual Gemini similarity for this rejected pair is generated, intentionally. Never fabricate an AI score to explain this case.
- **C: unknown brand.** Leave the lost brand blank; compatible known found attributes remain eligible. Mock/provider workflow tests cover text and one-photo/opposite-text paths. Live unknown-brand comparison is in the opt-in test but was not run here. Show the real result without inferring a missing brand or ownership probability.

Private object-photo comparison is supported, but the opt-in automated live fixture uses generated swatches only to verify actual multimodal transport. Different-angle/object recognition requires real permitted synthetic object photos in the app; mocked decoders/swatch similarity are not that evidence. Migration 008 and AI/demo configuration must be deployed before recording. Existing claims/pickup acceptance remains mandatory.

Verified 2026-10-25 in isolated in-memory PGlite and the real TypeScript matcher. Matching source: `aa22744` / handoff `7d831aa`; admin source inspected read-only at `origin/feature/admin-recovery` `3e8b18d`. Main remained `6cc04d2`. No production records, HTTP responses, credentials, images or remote migrations were fabricated or changed. These results verify engine/persistence behavior and a combined local SQL/repository workflow, not a hosted/browser acceptance run.

Use the words **potential match**, **compatible candidate**, and **staff verification required**. Classification and numeric indices are heuristic rankings, never ownership probabilities. There is no image/embedding model in this demo.

## Preconditions and recording order

1. Lead reviews/integrates the three feature branches and migrations before a real app rehearsal. Configure a dedicated disposable environment, separate student/staff sessions, and a synthetic active intake desk. Do not apply migrations to production without explicit authorization.
2. Apply sorted migrations `001_student_backend.sql`, `002_report_deletion.sql`, `003_admin_portal.sql`, `004_admin_recovery.sql`, `005_matching_engine.sql`, `006_pickup_reissue.sql`, `007_student_dropoff_visibility.sql`. Dependencies/details are below.
3. Use synthetic identities such as `student@synthetic.example`; no real account numbers, passwords, serials or private student details. No images are required for these matching checks.
4. Run cases separately in fresh disposable data, or complete A through the supported staff pickup flow before B. Assert the particular lost/found pair, not that a shared database has zero matches overall: other eligible found reports can legitimately match. Do not reset real statuses or mock successful APIs to stage the recording.
5. Use the past times below exactly for engine reproduction: lost `2026-10-24T12:00:00Z`, found `2026-10-24T12:15:00Z`, received `2026-10-24T13:00:00Z`. In America/New_York these are October 24 at 08:00, 08:15 and 09:00 EDT. Receive time must follow found time. For a later rehearsal, adjust both reports consistently to valid past times; classification can change with elapsed time.

## Scenario A - Strong potential match

| Field | Lost report | Found report |
| --- | --- | --- |
| Item name | Wireless earbuds | Wireless earbuds |
| Category | Electronics | Electronics |
| Brand | Apple | Apple |
| Model | AirPods Pro 2 | AirPods Pro 2 |
| Primary color | White | White |
| Description | White earbud case in a blue silicone sleeve with a small clip | Same synthetic description |
| Location | Unknown | Unknown found location; staff selects active synthetic intake desk |
| Time | Lost time above | Found/received times above |

**Expected:** compatible, strong potential match; staff must still verify ownership.

**Actual:** TS and SQL both returned `eligible:true`, `classification:"very_strong_match"`, no contradictions. The real save functions/trigger persisted exactly one candidate for this pair in isolated PGlite. No image similarity was supplied or invented.

**Reproduce in the app:** Student creates the lost report; staff receives the found report with the exact fields and an active desk. Refresh student Updates and admin Matches. Staff sees numeric factors/private report comparison. Continue with real information request, student response and approval if rehearsing recovery; only actual pickup marks Returned. Use synthetic private ownership detail separately, such as a concealed blue thread on the sleeve, without exposing found evidence to unrelated students.

**Integration update:** staff Matches/Claims/history now render stored private classifications and reasons with ranking-index labels. Identical observations do not establish ownership. All three cases are maintained in `services/matchingDemoAcceptance.test.ts` with actual TS/SQL/save-trigger checks. Final live hosted rehearsal remains blocked by migration authorization/deployment.

## Scenario B - Hard contradiction

| Field | Lost report | Found report |
| --- | --- | --- |
| Item name | AirPods Pro | Galaxy Buds |
| Category | Electronics | Electronics |
| Brand | Apple | Samsung |
| Model | AirPods Pro | Galaxy Buds 2 |
| Primary color | White | White |
| Description | White earbud case in a blue silicone sleeve with a small clip | Exactly the same description |
| Location/time | Unknown / lost time above | Unknown / found and received times above |

**Expected:** NO MATCH despite deliberately similar descriptive evidence.

**Actual:** TS and SQL returned `eligible:false`, `classification:"no_match"`, contradictions `Brand mismatch: apple versus samsung` and `Model mismatch: airpods pro versus galaxy buds 2`. No candidate was inserted for the pair by the real trigger. Even supplying optional imageSimilarity=1 and semanticSimilarity=1 to the evaluator still returned rejection; these were synthetic scoring inputs for a test, not output from an AI model.

**Reproduce in the app:** After isolating the data as above, create the lost Apple report and receive the found Samsung report. Refresh both portals and verify the pair is absent. If showing engineering evidence, run the local evaluator snippet below and show its actual rejection result. New rejected pairs are intentionally not persisted, and there is no existing UI rejection card; do not fake one or claim a student endpoint returns private rejection explanations.

**Limitations:** the assertion concerns this pair only. A different compatible Apple report elsewhere in shared data could still produce a candidate. Detailed engine explanations remain staff/backend information.

## Scenario C - Unknown information

| Field | Lost report | Found report |
| --- | --- | --- |
| Item name | Black backpack | Black backpack |
| Category | Backpack | Backpack |
| Brand | Blank / unknown | Nike |
| Model | Blank | Blank |
| Primary color | Black | Black |
| Description | Black backpack with two zippers and a red fabric loop | Same synthetic description |
| Location/time | Unknown / lost time above | Unknown / found and received times above |

**Expected:** evaluated rather than automatically rejected for unknown brand.

**Actual:** TS and SQL returned `eligible:true`, `classification:"very_strong_match"`, no contradictions; exactly one candidate for the pair was persisted in isolated PGlite. Missing brand/model/location weights were omitted, not converted into mismatches. No Nike brand was inferred for the student.

**Reproduce in the app:** Submit the lost backpack with a blank brand/model and unknown location; staff receives the described Nike backpack at the active desk. Refresh Updates/Matches and review the candidate privately. Explain that missing information leaves a candidate eligible and staff still requires independent ownership evidence.

**Limitations:** this classification is an uncalibrated available-factor ranking. Unrelated black backpacks with the same generic observations can receive the same high classification. Do not describe eligibility or that classification as proof that both reports concern one object.

## Standalone, production-free reproduction of A/B/C

From the application root `reclaim/` with the existing dependencies installed, create ignored directory `.next-matching-demo/` and save the following as `demo.mts` inside it. Run `node --conditions=react-server --import tsx .next-matching-demo/demo.mts`. On this Windows host Node is at `C:/Program Files/nodejs/node.exe` if absent from PATH. No environment file or service credential is needed. The script applies checked-in local SQL only to an in-memory database, evaluates actual SQL/TS logic and prints engine results; it does not intercept or impersonate API responses.

```typescript
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { assessMatch } from '../services/matchingService.ts';
const base = (type, extra = {}) => ({
  id: type === 'lost' ? '77777777-7777-4777-8777-000000000010'
                      : '77777777-7777-4777-8777-000000000011',
  reporterId: '77777777-7777-4777-8777-000000000001', type,
  name: 'Wireless earbuds', category: 'Electronics', brand: 'Apple',
  model: 'AirPods Pro 2', color: 'White',
  description: 'White earbud case in a blue silicone sleeve with a small clip',
  features: '', location: 'Unknown', lat: null, lng: null, image: '',
  date: type === 'lost' ? '2026-10-24T12:00:00Z' : '2026-10-24T12:15:00Z',
  status: type === 'lost' ? 'Matching' : 'Secured', ...extra,
});
const bag = { name: 'Black backpack', category: 'Backpack', brand: '',
  model: '', color: 'Black',
  description: 'Black backpack with two zippers and a red fabric loop' };
const cases = [
  ['A', base('lost'), base('found'), true],
  ['B', base('lost', { name: 'AirPods Pro', model: 'AirPods Pro' }),
    base('found', { name: 'Galaxy Buds', brand: 'Samsung', model: 'Galaxy Buds 2' }), false],
  ['C', base('lost', bag), base('found', { ...bag, brand: 'Nike' }), true],
];
const db = new PGlite();
try {
  const dir = new URL('../db/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith('.sql')).sort())
    await db.exec(await readFile(new URL(file, dir), 'utf8'));
  for (const [label, lost, found, expected] of cases) {
    const js = assessMatch(lost, found);
    const sql = (await db.query('select evaluate_report_match($1::jsonb,$2::jsonb) a',
      [JSON.stringify(lost), JSON.stringify(found)])).rows[0].a;
    assert.equal(js.eligible, expected);
    assert.equal(sql.eligible, expected);
    assert.equal(sql.classification, js.classification);
    console.log(label, { eligible: sql.eligible,
      classification: sql.classification, contradictions: sql.contradictions });
  }
} finally { await db.close(); }
```

The committed matching suites also reproduce the maintained alias/adversarial/persistence cases: `node --conditions=react-server --import tsx --test services/matchingEngine.test.ts services/matchingService.test.ts`. The independent final QA below additionally used the admin branch's actual 004/006/007 SQL and adminRepository in an ignored local harness; those files were inspected/copied read-only, not merged into this branch.

## Independent final QA matrix - 22 scenarios

All rows passed their stated expectation in TS and SQL evaluators. Trigger counts were observed through actual `save_student_report`/`save_found_report` calls, one isolated transaction per pair. No API success was mocked. All ranking classes are heuristic, not probability estimates.

| # | Synthetic case | Evaluator result | Trigger candidate count |
| --- | --- | --- | --- |
| 1 | A Same brand/model/color | Eligible / very_strong_match | 1 |
| 2 | Different brands | NO MATCH | 0 |
| 3 | Different models | NO MATCH | 0 |
| 4 | Different categories | NO MATCH | 0 |
| 5 | Different item types | NO MATCH | 0 |
| 6 | Completely different primary colors | NO MATCH | 0 |
| 7 | Navy / dark blue | Eligible / very_strong_match | 1 |
| 8 | Charcoal / dark gray | Eligible / very_strong_match | 1 |
| 9 | C Black backpack / unknown brand | Eligible / very_strong_match | 1 |
| 10 | Unknown model | Eligible / very_strong_match | 1 |
| 11 | Unknown location | Eligible / very_strong_match | 1 |
| 12 | Moved between campus locations | Eligible / very_strong_match | 1 |
| 13 | Identical-looking unrelated objects with different identifiers | NO MATCH | 1 (IDs not captured by intake; see limit) |
| 14 | Conflicting full asset tags | NO MATCH | 1 (IDs not captured by intake; see limit) |
| 15 | B AirPods Pro / Galaxy Buds, same description | NO MATCH | 0 |
| 16 | Incomplete report, no model/brand/color/details | Eligible / weak_match | 0 |
| 17 | Identical-looking without distinguishing evidence | Eligible / very_strong_match | 1 |
| 18 | Compatible model alias | Eligible / very_strong_match | 1 |
| 19 | Uncertain brand | Eligible / very_strong_match | 1 |
| 20 | Same full identifier, punctuation alias | Eligible / very_strong_match | 1 |
| 21 | Compatible but weaker description | Eligible / possible_match | 1 |
| 22 | Older lost, newer found report | Eligible / strong_match | 1 |

**What the matrix establishes:** brand/model/category/type/color contradictions prevent persistence even with identical descriptions. Unknown brand/model/location and moved items do not hard-reject. The fully compatible case ranked above the weaker-description case; the older report remained a Strong Match. Incomplete evidence was eligible but Weak Match and below the persistence threshold, which is different from a contradiction-based NO MATCH.

**Identifier gap, explicitly observed:** rows 13/14 reject when a full identifier map is passed to either evaluator, but the live report save/input contract does not store that map. The ordinary persisted reports therefore still produce one candidate based on their shared visible fields. This is not an end-to-end full-ID filter. Existing `serial_fragment` and private prose cannot safely be guessed into aligned full identifiers. Do not claim automatic unique-identifier rejection in the recording. No architecture/intake expansion is attempted during freeze.

**Indistinguishable items:** row 17 remains eligible/high-ranked because its inputs contain no observable contradiction. Similar-looking unrelated objects require private ownership evidence and human review. This remains a known precision/calibration limitation, not verified ownership.

## Admin contract and migrations

- Admin matches retain `id`, `lost_report_id`, `found_report_id`, `score`, numeric `factors`, `distance_km`, `minutes_difference`, `dismissed`, timestamps. Actual remote adminRepository's `select *` includes additive `staff_reasoning`; no required field was removed or renamed. Admin uses Object.entries for factors, so new numeric factor labels are compatible.
- `staff_reasoning` contains eligible/classification/contradictions/matchingFactors/policyVersion plus score/factors/distance/minutes. Student workspace and direct match HTTP projection omit it; the combined local repository check verified staff visibility and owner omission. Public Search stays the six-field view.
- **Presentation gap:** current AdminPortal does not consume classification or staff_reasoning. It still displays numeric similarity with an ownership-proof warning. Developer 2/lead can consume those fields later; this QA does not edit admin components or invent a UI demonstration. New rejected pairs have no persisted row/card. Historical closed/assigned rows may have empty reasoning and need a fallback if a consumer is later added.
- 004 guards submission/review/return and respects dismissed matches; 005 can dismiss incompatible existing pairs while retaining claims; remote admin claimReviewable excludes dismissed matches. 006 renews an approved expired pass while preserving its assignment. None of these changes requires a different matching payload.
- Correct order is **001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007**. 005 requires the reports/potential_matches schema and 003's trigger baseline; it replaces matching-only functions and adds staff_reasoning. 004's terminal-state guards must remain in the final tree. 006 requires the recovery tables and the 004 state/lock policy; it adds only reissue_expired_pickup and does not replace the matcher. 007 adds only student_visible/public_instructions on dropoff_zones, with hidden/empty defaults and no matcher or recovery replacement. Student-visible desks require explicit staff review/publication after deployment. There is no numerical filename collision.
- Combined local application and full sorted replay passed. Definitions of submit_ownership_claim, review_ownership_claim and redeem_pickup were identical before/after 005/006/007. The matcher remained compatibility-v1 after replay. Replaying only 003 would regress the matcher; the migration runner must finish the full sorted directory. Merge the two branches' adminBackend fixture additions carefully, keeping both 004 and 005 loads with 005 last after any historical replay.
- Actual isolated SQL/remote-adminRepository lifecycle passed: submit -> More information -> updated response/Pending -> approval -> expiry -> reissue via 006 -> old code denied -> new code accepted once -> both reports Returned -> duplicate redemption denied -> full 001-007 replay leaves both Returned. This is local database/repository evidence, not live HTTP/browser/Neon/Blob proof.

## Recording decision

No critical matching-owned defect was found that prevents the specified A/B/C video. **Matching branch is FROZEN for final integration** after the verification recorded in Developer 3's log. No application changes or new providers are part of this QA.

The lead must still integrate/review/apply the ordered migrations in an authorized disposable environment and perform the actual hosted two-session rehearsal before recording. That deployment/acceptance gate is unverified here. If the script promises automatic full-ID filtering or rendered classification/rejection-reason cards, those claims must be removed: the current integrated contracts do not provide that complete presentation/capture path. Simultaneous independent PostgreSQL report creation, model calibration, verified real student identity, image AI and external service health are not certified by this QA.
