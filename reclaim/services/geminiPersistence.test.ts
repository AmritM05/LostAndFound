import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { EmbeddingService, type AIConfig } from "../lib/server/ai/embeddings";
import { runAIMatching } from "../lib/server/ai/workflow";
import { repository } from "../lib/server/repository";
const id = (n: number) =>
  `99999999-9999-4999-8999-${String(n).padStart(12, "0")}`;
const config: AIConfig = {
  enabled: true,
  demo: true,
  apiKey: "synthetic-unit-key",
  model: "gemini-embedding-2",
  dimensions: 768,
  timeoutMs: 200,
};
const v = () => Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
async function fixture() {
  const db = new PGlite();
  const q = async (sql: string, args: any[] = []) =>
    (await db.query(sql, args)).rows as any[];
  const dir = new URL("../db/migrations/", import.meta.url);
  for (const file of (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(file, dir), "utf8"));
  await q(
    "insert into users(id,email,display_name,role) values($1,'ai-staff@example.test','Staff','admin'),($2,'ai-owner@example.test','Owner','student'),($3,'ai-other@example.test','Other','student')",
    [id(1), id(2), id(3)],
  );
  await db.exec("drop trigger reports_match on reports");
  for (const [n, type, owner, description] of [
    [10, "lost", 2, "Crimson fabric loop on a nylon rucksack"],
    [11, "found", 1, "A red carrying tab on a travel bag"],
  ] as const)
    await q(
      "insert into reports(id,reporter_id,report_type,category,item_name,brand,primary_color,description,lost_date,lost_time,occurred_at,status,custody_status) values($1,$2,$3,'Backpack','Backpack','Nike','Black',$4,current_date,current_time,now(),$5,$6)",
      [
        id(n),
        id(owner),
        type,
        description,
        type === "lost" ? "Matching" : "Secured",
        type === "found" ? "Stored" : null,
      ],
    );
  const snapshots = () =>
    q(
      "select r.id,ai_report_revision(r) as revision from reports r order by id",
    );
  return { db, q, snapshots };
}
test("actual persisted AI contribution improves semantic ranking, keeps private provenance and reuses cached embeddings", async () => {
  const f = await fixture();
  try {
    let calls = 0;
    const provider = new EmbeddingService(config, async () => ({
      models: {
        embedContent: async () => {
          calls++;
          return { embeddings: [{ values: v() }] };
        },
      },
    }));
    const [baseline] = await f.q(
      "select evaluate_report_match(report_matching_input(l),report_matching_input(r)) a from reports l,reports r where l.id=$1 and r.id=$2",
      [id(10), id(11)],
    );
    const result = await runAIMatching(id(1), id(10), id(11), f.q, provider);
    assert.equal(result.mode, "gemini");
    assert.equal(result.applied, true);
    assert.ok(result.assessment.score > baseline.a.score);
    assert.deepEqual(result.assessment.ai.channels, ["semantic"]);
    assert.equal(result.assessment.ai.model, "gemini-embedding-2");
    assert.equal(calls, 2);
    await runAIMatching(id(1), id(10), id(11), f.q, provider);
    assert.equal(calls, 2);
    assert.equal(
      (
        await f.q(
          "select count(*)::int n from updates where title='Possible match'",
        )
      )[0].n,
      1,
    );
    const [match] = await f.q("select * from potential_matches");
    assert.equal(match.staff_reasoning.ai.used, true);
    const owned = await repository(f.q).workspace({ id: id(2) } as any);
    assert.equal(owned.state.matches.length, 1);
    assert.ok(!JSON.stringify(owned).includes("gemini-embedding-2"));
    assert.ok(!JSON.stringify(owned).includes("embeddings"));
    assert.equal(
      (await repository(f.q).workspace({ id: id(3) } as any)).state.matches
        .length,
      0,
    );
    await f.q(
      "update reports set description='A new synthetic description' where id=$1",
      [id(10)],
    );
    await runAIMatching(id(1), id(10), id(11), f.q, provider);
    assert.equal(calls, 3);
    // Missing-key fallback must clear the prior AI label when deterministic scoring is applied.
    const fallback = await runAIMatching(
      id(1),
      id(10),
      id(11),
      f.q,
      new EmbeddingService({ ...config, apiKey: "" }),
    );
    assert.equal(fallback.mode, "deterministic");
    assert.equal(fallback.assessment.ai, undefined);
    assert.equal(
      (await f.q("select staff_reasoning from potential_matches"))[0]
        .staff_reasoning.ai,
      undefined,
    );
  } finally {
    await f.db.close();
  }
});
test("contradiction filtering is rechecked in SQL and no provider call can override it", async () => {
  const f = await fixture();
  try {
    let calls = 0;
    const provider = new EmbeddingService(config, async () => ({
      models: {
        embedContent: async () => {
          calls++;
          return { embeddings: [{ values: v() }] };
        },
      },
    }));
    await assert.rejects(
      runAIMatching(id(2), id(10), id(11), f.q, provider),
      /Staff access required/,
    );
    await f.q("update reports set brand='Adidas' where id=$1", [id(11)]);
    const result = await runAIMatching(id(1), id(10), id(11), f.q, provider);
    assert.equal(result.reason, "incompatible");
    assert.equal(calls, 0);
    const revisions = await f.snapshots();
    const [row] = await f.q(
      "select apply_ai_match($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) a",
      [
        id(1),
        id(10),
        id(11),
        revisions[0].revision,
        revisions[1].revision,
        JSON.stringify({ semanticSimilarity: 1, imageSimilarity: 1 }),
        JSON.stringify({ model: "gemini-embedding-2", dimensions: 768 }),
      ],
    );
    assert.equal(row.a.applied, false);
    assert.equal(row.a.assessment.eligible, false);
    assert.equal(
      (await f.q("select count(*)::int n from potential_matches"))[0].n,
      0,
    );
    await assert.rejects(
      f.q("select apply_ai_match($1,$2,$3,$4,$5,'{}','{}')", [
        id(2),
        id(10),
        id(11),
        revisions[0].revision,
        revisions[1].revision,
      ]),
      /Access denied/,
    );
  } finally {
    await f.db.close();
  }
});
test("inference races cannot persist stale results, reopen terminal reports or override dismissed/recovery pairs", async () => {
  const f = await fixture();
  try {
    let calls = 0;
    const provider = new EmbeddingService(config, async () => ({
      models: {
        embedContent: async () => {
          if (++calls === 1)
            await f.q(
              "update reports set description='Changed during inference' where id=$1",
              [id(10)],
            );
          return { embeddings: [{ values: v() }] };
        },
      },
    }));
    const stale = await runAIMatching(id(1), id(10), id(11), f.q, provider);
    assert.equal(stale.reason, "stale-report");
    assert.equal(stale.applied, false);
    const current = await runAIMatching(id(1), id(10), id(11), f.q, provider);
    assert.equal(current.applied, true);
    const [m] = await f.q("select id from potential_matches");
    await f.q("update potential_matches set dismissed=true");
    const before = calls;
    assert.equal(
      (await runAIMatching(id(1), id(10), id(11), f.q, provider)).reason,
      "dismissed",
    );
    assert.equal(calls, before);
    await f.q("update potential_matches set dismissed=false");
    await f.q(
      "insert into claims(match_id,claimant_id,answers) values($1,$2,'Synthetic evidence')",
      [m.id, id(2)],
    );
    assert.equal(
      (await runAIMatching(id(1), id(10), id(11), f.q, provider)).reason,
      "active-recovery",
    );
    assert.equal(calls, before);
    await f.q("update claims set status='Returned'");
    await f.q("update reports set status='Returned'");
    assert.equal(
      (await runAIMatching(id(1), id(10), id(11), f.q, provider)).reason,
      "incompatible",
    );
    assert.equal(calls, before);
    assert.equal(
      (
        await f.q("select count(*)::int n from reports where status='Returned'")
      )[0].n,
      2,
    );
  } finally {
    await f.db.close();
  }
});
test("provider errors preserve deterministic ranking and configurable AI weights apply only to actual signals", async () => {
  const f = await fixture();
  const previous = process.env.MAGPIE_AI_MATCHING_WEIGHTS;
  try {
    const failing = new EmbeddingService(config, async () => ({
      models: {
        embedContent: async () => {
          throw Error("Synthetic outage");
        },
      },
    }));
    let result = await runAIMatching(id(1), id(10), id(11), f.q, failing);
    assert.equal(result.mode, "deterministic");
    assert.equal(result.assessment.ai, undefined);
    const baseline = result.assessment.score;
    process.env.MAGPIE_AI_MATCHING_WEIGHTS = '{"Description":80,"Time":1}';
    const realShapeMock = new EmbeddingService(config, async () => ({
      models: { embedContent: async () => ({ embeddings: [{ values: v() }] }) },
    }));
    result = await runAIMatching(id(1), id(10), id(11), f.q, realShapeMock);
    assert.equal(result.assessment.ai.weights.Description, 80);
    assert.equal(result.assessment.ai.weights.Time, 1);
    result = await runAIMatching(id(1), id(10), id(11), f.q, failing);
    assert.equal(result.assessment.score, baseline);
    assert.equal(result.assessment.ai, undefined);
  } finally {
    if (previous === undefined) delete process.env.MAGPIE_AI_MATCHING_WEIGHTS;
    else process.env.MAGPIE_AI_MATCHING_WEIGHTS = previous;
    await f.db.close();
  }
});
