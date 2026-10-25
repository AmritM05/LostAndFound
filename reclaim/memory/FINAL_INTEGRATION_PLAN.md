# Final hackathon integration — 2026-10-25

The lead authorized integration after all teammates froze their branches. The earlier merge hold is lifted; the remote-write prohibition remains. All three snapshots are merged into `integration/final-hackathon`, preserving preparation history. Main and feature branches were not rewritten. Draft PR #2 remains the review boundary; do not merge it automatically.

## Integrated snapshots and conflicts

| Source | Frozen head | Merge / resolution |
| --- | --- | --- |
| Student | `a686d21` | `d0b8247`; preserved both student and preparation histories in Developer 1's log |
| Admin | `3e8b18d` | `c6cfd3e`; clean merge |
| Matching | `cefd1c5` | `c90f65f`; combined repeated 003/004/005 fixtures and added 006/007 in adminBackend.test.ts, retaining both branches' business assertions |

Exact source hashes are in `tests/final-integration-snapshots.json`. After each merge, full tests and TypeScript passed: student 87 passed / 2 skipped / 3 TODO; admin 106 / 2 / 3; matching 113 / 0 / 3. These are successive overlapping suites, not additive totals. Integration replaced the obsolete matching placeholders with executable demo/persistence coverage.

## Integration wiring

- Student guidance now requests authenticated `GET /api/dropoffs/`. Only active, staff-published campus desks are returned. `description` maps to public instructions; building names/coordinates are public. The adapter whitelists fields, drops other-campus/inactive records and has no unverified configuration fallback. Loading, retry, empty and public-coordinate Google Maps links are covered.
- Staff Matches, Claims and history display stored classifications and private factors/contradictions. Historical missing reasoning is labelled unavailable. Numeric scores are ranking indices, never ownership probabilities. New rejected pairs are not stored, so no rejection card is fabricated. Student/public projections still omit reasoning.
- Three documented matching cases execute actual TS evaluator, SQL evaluator and report-save triggers in isolated PGlite. Compatible A and unknown-brand C persist; contradictory B does not. The integrated recovery audit also rejects incompatible model/color pairs.

## Verification and remaining gates

See [VERIFICATION](VERIFICATION.md) for final counts and limits. Production build, TypeScript, full tests and synthetic student/staff browser checks cover the integrated source. The local audit executes and replays all seven migrations, preserves migration-004 recovery guards through 005–007, private correspondence, renewal/old-code rejection, single-use pickup and competing-claim denial.

Remote SELECT/read-only checks: Neon connects; Blob list token accepted; admin credentials configured. **005 evaluator/reasoning column, 006 renewal function, and both 007 publication columns are absent.** All three recovery function bodies differ from reviewed 004. No migration ledger exists, so exact historical deployment order is unknown. No remote writes, sessions, reports, uploads, claims, pickups, migrations or deployment promotions were performed.

The connected database is incompatible with the integrated application. Do not record a claimed complete live recovery against it. Required next actions:

1. Owner identifies and explicitly authorizes a disposable Neon/database and private Blob target.
2. Review backups/disposal and quiesce application writes. The runner replays all sorted SQL; intermediate 003 definitions precede replacements, and a later-file failure does not roll back earlier commits.
3. Run the normal migration runner in exact order **001 → 002 → 003 → 004 → 005 → 006 → 007**. Do not apply archived Supabase SQL. Verify markers/functions after completion.
4. Staff creates an active desk and explicitly publishes student visibility/public instructions. 007 defaults existing desks hidden and never copies private instructions.
5. Run real opt-in acceptance and a two-profile student/staff rehearsal, including private photo bytes, contradiction, information response, approval, pickup and stale competing denial. Independent PostgreSQL concurrency is not proven by PGlite.
6. Record the approximately three-minute sequence in [DEMO_RUNBOOK](DEMO_RUNBOOK.md). Until then, only an explicitly labelled synthetic demonstration is ready.

## Reproduction

From the integration application's `reclaim/` directory:

```sh
npm ci
npm test
npm run typecheck
node scripts/audit-final-migrations.mjs
MAGPIE_NEXT_DIST_DIR=.next-final-demo npm run build
MAGPIE_NEXT_DIST_DIR=.next-final-demo npm start -- --hostname 127.0.0.1 --port 3011
```

The audit uses frozen Git SQL in a temporary PGlite database; no environment file/network or remote writes. Production startup requires privately configured environment variables and an authorized migrated target; see the runbook. Browser fixtures and live tests must remain clearly distinguished. No AI provider/model is integrated.
