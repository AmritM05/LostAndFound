# Matching: current heuristic and target design

## Status and authoritative implementation

**Current:** automatic heuristic matching is implemented and tested. **No AI model is integrated.** `services/imageAnalysisService.ts` is a placeholder: `extractItemAttributes` returns manual/default attributes with confidence zero; `generateImageEmbedding` returns null. There is no provider SDK, AI API call, OCR, embedding storage or vector index in the active pipeline. Photos are private evidence for humans, not current scoring inputs.

Runtime persistence is the `reports_match` trigger / `refresh_report_matches` / `match_text` in `db/migrations/003_admin_portal.sql`. `services/matchingService.ts` provides TypeScript `textSimilarity`, `distanceKm`, `calculateMatchScore` and `findMatches` for reference/testing; it does not invoke the runtime matcher over HTTP. Do not update only the TypeScript helper and claim production matching changed.

## Candidate generation and refresh

The SQL trigger runs after report insert or update of category, name, brand, model, primary color, description, occurrence time and coordinates. It considers opposite-type reports not Returned/Archived; it also skips a new/updated Returned/Archived report. It scores broadly and persists pairs with score at least 60, capped at 99. New matches create private owner notices. Existing pairs update score/factors, retaining dismissal. A below-threshold pair is dismissed only when it has no claims. There is no AI queue, bulk historical rebuild or versioned recomputation endpoint.

Candidates are **not** eliminated for known incompatible brand/model, category or color. Time/location are ranking factors, not hard exclusions. SQL pair uniqueness prevents duplicate pair rows, but simultaneous opposite-type inserts may miss one another until later refresh; this race is a code-derived risk, not a demonstrated production outage. A dismissed pair that later improves remains dismissed, and stale claimed pairs can remain visible after incompatibility changes.

## Current formula (not the requested new weights)

Tokenization lowercases, removes non-ASCII alphanumeric punctuation, discards tokens of length <=2, deduplicates and maps clip→keychain, silicone→case, grey→gray. Text similarity is Dice overlap: twice shared token count divided by total token counts; empty text scores zero.

Let C=100 for equal category, otherwise 0. B=brand/model text overlap ×100 if both brands exist, otherwise 50. K=100 for equal case-insensitive primary color, otherwise 20. D=name+description text overlap ×100. V=round((C+K+B)/3 ×0.85). T=round(max(20,100−abs(minutes)/10)). L=round(max(35,100−24×distanceKm)) when both coordinates exist. F=feature/description overlap on a 0–1 scale.

```text
score = min(99, round((0.15C + 0.15B + 0.20D + 0.25V
                      + 0.10L + 0.10T + 5F) / denominator))
denominator = 0.9 when location is missing, otherwise 1
```

Missing L is omitted. SQL uses report descriptions for F; TypeScript uses Item.features. Active stored Item.features is projected from description, but arbitrary reference fixtures can differ. SQL/JavaScript numeric rounding and missing-value behavior need parity coverage beyond a single fixture. “Brand & category” is a display factor, not an extra term. “Visual attributes” means manually entered category/color/brand, not photo analysis.

Missing brand is assigned a neutral 50; missing text scores zero; missing location is reweighted. There is **no generalized available-factor normalization**. Routes require a primary color, but there is no normalized unknown-color vocabulary. Haversine distance is used when valid coordinates exist; missing coordinates remain unknown rather than fabricated zero distance.

## Confirmed incompatibility defect

During the 2026-10-24 memory audit, the actual TypeScript helper scored Apple AirPods versus Samsung Galaxy Buds at **70**, above the candidate threshold of 60, with black color, matching generic case description, identical time and nearby/equal coordinates. Both known brand values contradicted one another. This demonstrates the missing rejection stage; existing ranking tests do not prove contradiction safety. SQL uses the same soft brand concept, so its production path also needs explicit regression coverage.

## Current human review and presentation

Students see private match metadata attached to their own lost report, without found photos/identity/description. They submit an ownership answer; staff privately compare full reports and claims, then request information, reject or approve. Pickup is independent of score.

Student labels currently include Possible match, Strong possible match (75+) and Very likely match (90+), alongside numeric percent similarity. Staff display similarity as a percent with a warning that it is not ownership proof. These are uncalibrated heuristic scores; the requested future label approach is not fully implemented.

## Target stage 1 — planned, not implemented

Define a compatibility contract for normalized category, item type, brand, model, primary color and distinguishing identifiers, including provenance and confidence of each value. Reject high-confidence contradictions **before** ranking. Required examples:

- Apple AirPods versus Samsung Galaxy Buds: reject.
- Confirmed Nike versus Adidas backpack: reject.
- Clearly incompatible confirmed primary colors: reject.
- Missing brand, unknown color or low-confidence extraction: do not reject merely for absence.
- Time and location generally rank candidates; they do not automatically disqualify distant/older recovery.

Normalization and synonym rules must avoid conflating generic words, empty fields, product families or ambiguous colors with confirmed contradictions. Do not use private owner-only evidence in public responses.

## Target stage 2 — proposed weights, not active configuration

| Signal | Proposed weight |
| --- | --- |
| Image similarity | 30% |
| Description similarity | 20% |
| Brand/model/attributes | 20% |
| Color/visual details | 10% |
| Location | 10% |
| Time | 10% |

Reweight only available reliable signals. When images/model are absent, do not invent similarity or insert zero evidence by default; use an explicit fallback/abstention policy. Use Strong Match/Possible Match and explanations rather than ownership probabilities. Any display of raw similarity must be clearly non-probabilistic and evaluated on a labelled dataset.

No specific AI vendor/model has been selected. A future proposal must define privacy boundaries for private photo processing, cost/latency, failures/timeouts, extraction confidence, model/version tracking, human override and migration/backfill. Never send private images to a provider merely because an API key becomes available.

## Required tests and implementation dependencies

MAG-001 defines compatibility/score contracts; MAG-002 adds contradiction regression cases; MAG-007 addresses matcher lifecycle/parity; MAG-011 scopes actual AI. Test missing and contradictory attributes separately, color synonyms, brand/model product families, Unicode/short identifiers, time direction, unknown location, available-weight normalization, idempotence, dismissal semantics, concurrent creation and non-owner privacy. Extend active Neon/PGlite tests rather than relying only on archived Supabase routines.

See [backlog](TASK_BACKLOG.md), [API contracts](API_CONTRACTS.md), [database](DATABASE.md) and [verification](VERIFICATION.md).
