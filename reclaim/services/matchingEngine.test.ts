import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { assessMatch, calculateMatchScore, findMatches } from "./matchingService";
import { matchingPolicy, normalizeAttribute, normalizeModel, type MatchingItem } from "./matchingAttributes";
import { repository } from "../lib/server/repository";
import { adminRepository } from "../lib/server/adminRepository";
import { extractItemAttributes, generateImageEmbedding } from "./imageAnalysisService";

const id = (n: number) => `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`;
const item = (type: "lost" | "found", extra: Partial<MatchingItem> = {}): MatchingItem => ({
  id: type === "lost" ? id(10) : id(11), reporterId: id(type === "lost" ? 1 : 2), type,
  name: "Wireless earbuds", category: "Electronics", brand: "Apple", model: "AirPods Pro 2", color: "Black",
  description: "Black case with hidden green stitching and a small clip", features: "", location: "Unknown",
  lat: null, lng: null, date: "2026-10-24T12:00:00Z", status: "Matching", image: "", ...extra,
});
const scenarios: { name: string; lost?: Partial<MatchingItem>; found?: Partial<MatchingItem>; eligible: boolean }[] = [
  { name: "Apple AirPods versus Samsung Galaxy Buds despite identical description", found: { brand: "Samsung", model: "Galaxy Buds 2" }, eligible: false },
  { name: "confirmed Nike versus Adidas backpacks", lost: { name: "Backpack", category: "Backpack", brand: "Nike", model: "" }, found: { name: "Backpack", category: "Bags", brand: "Adidas", model: "" }, eligible: false },
  { name: "different confirmed generations", found: { model: "AirPods Pro 1" }, eligible: false },
  { name: "Pro versus standard are not the same model", found: { model: "AirPods 2" }, eligible: false },
  { name: "short phone model agrees with qualified intake", lost: { name: "Phone", model: "15 Pro Max" }, found: { name: "Phone", model: "iPhone 15 Pro Max" }, eligible: true },
  { name: "qualified phone agrees with short intake", lost: { name: "Phone", model: "iPhone 15 Pro" }, found: { name: "Phone", model: "15 Pro" }, eligible: true },
  { name: "short phone variants stay distinct", lost: { name: "Phone", model: "15 Pro" }, found: { name: "Phone", model: "iPhone 15 Pro Max" }, eligible: false },
  { name: "short phone generations stay distinct", lost: { name: "Phone", model: "14 Pro" }, found: { name: "Phone", model: "iPhone 15 Pro" }, eligible: false },
  { name: "specific iPhone model variants stay distinct", lost: { model: "iPhone 13" }, found: { model: "iPhone 13 Pro" }, eligible: false },
  { name: "different explicit model codes", lost: { model: "SM-G991B" }, found: { model: "SM-G996B" }, eligible: false },
  { name: "model punctuation and whitespace are compatible", lost: { model: "SM-G991B" }, found: { model: "SMG991B" }, eligible: true },
  { name: "generation alias and brand punctuation", lost: { brand: "APPLE, Inc.", model: "Air Pods Pro (2nd Gen)" }, eligible: true },
  { name: "generation-first model alias", found: { model: "AirPods Pro Gen 2" }, eligible: true },
  { name: "model family without a generation is uncertain, not contradictory", found: { model: "AirPods Pro" }, eligible: true },
  { name: "bright yellow versus black", found: { color: "Bright-yellow" }, eligible: true },
  { name: "navy versus dark blue", lost: { color: "Navy" }, found: { color: "dark-blue" }, eligible: true },
  { name: "charcoal versus dark gray", lost: { color: "Charcoal" }, found: { color: "Dark grey" }, eligible: true },
  { name: "ambiguous dark colors are not hard contradictions", lost: { color: "Black" }, found: { color: "Navy blue" }, eligible: true },
  { name: "missing brand is not a contradiction", found: { brand: "" }, eligible: true },
  { name: "unknown brand vocabulary", found: { brand: "N/A" }, eligible: true },
  { name: "uncertain brand is ignored", found: { brand: "Probably Samsung" }, eligible: true },
  { name: "alternative brands are uncertain", found: { brand: "Apple or Samsung" }, eligible: true },
  { name: "combined brands are uncertain", found: { brand: "Apple & Samsung" }, eligible: true },
  { name: "alternative models are uncertain", found: { model: "AirPods Pro 2 or 3" }, eligible: true },
  { name: "explicit uncertain attribute is ignored", found: { brand: "Samsung", uncertainAttributes: ["brand"] }, eligible: true },
  { name: "unknown and ambiguous colors", found: { color: "black/yellow" }, eligible: true },
  { name: "unknown color vocabulary", found: { color: "Not sure" }, eligible: true },
  { name: "unrecognized color is not a confirmed contradiction", found: { color: "bluish silver flecks" }, eligible: true },
  { name: "category contradiction", found: { category: "Clothing", model: "" }, eligible: false },
  { name: "Other is unknown category", found: { category: "Other" }, eligible: true },
  { name: "known generic item types differ", lost: { name: "Laptop", model: "" }, found: { name: "Phone", model: "" }, eligible: false },
  { name: "case accessories have ambiguous type", found: { name: "Phone case", model: "" }, eligible: true },
  { name: "conflicting full serial numbers", lost: { identifiers: { serial: "AB-123" } }, found: { identifiers: { "serial number": "AB-124" } }, eligible: false },
  { name: "identifier formatting aliases", lost: { identifiers: { serial: "AB-123" } }, found: { identifiers: { "serial number": "ab 123" } }, eligible: true },
  { name: "fragments are not full identifiers", lost: { identifiers: { serialFragment: "123" } }, found: { identifiers: { serialFragment: "456" } }, eligible: true },
  { name: "internally inconsistent identifier aliases are uncertain", lost: { identifiers: { serial: "AB-123", "serial number": "AB-124" } }, found: { identifiers: { serial: "AB-125" } }, eligible: true },
  { name: "moved between distant buildings", lost: { lat: 40, lng: -83, buildingId: "library" }, found: { lat: 40.1, lng: -83.1, buildingId: "gym" }, eligible: true },
  { name: "older lost report and newer found report", found: { date: "2026-10-25T12:00:00Z" }, eligible: true },
  { name: "time direction does not reject", found: { date: "2026-10-24T11:59:30Z" }, eligible: true },
  { name: "returned report excluded", lost: { status: "Returned" }, eligible: false },
  { name: "assigned report excluded", found: { status: "Ready for Pickup" }, eligible: false },
];

test("hard contradictions precede ranking, including perfect optional image/semantic similarity", () => {
  for (const s of scenarios) {
    const assessment = assessMatch(item("lost", s.lost), item("found", s.found), { imageSimilarity: 1, semanticSimilarity: 1 });
    assert.equal(assessment.eligible, s.eligible, s.name);
    if (!s.eligible) {
      assert.equal(assessment.score, 0, s.name);
      assert.equal(assessment.classification, "no_match", s.name);
      assert.ok(assessment.contradictions.length, s.name);
      assert.deepEqual(assessment.factors, {}, s.name);
    }
  }
});

test("missing signals redistribute weight; missing details stay eligible without an identity-factor cap; ranking is deterministic", () => {
  const a = item("lost"), b = item("found");
  const baseline = assessMatch(a, b);
  assert.equal(baseline.score, 99);
  assert.ok(!("Image similarity" in baseline.factors));
  assert.ok(!("Location" in baseline.factors));
  assert.deepEqual(assessMatch(a, b, { imageSimilarity: NaN, semanticSimilarity: 2 }), baseline);
  const thin = assessMatch(item("lost", { brand: "", model: "", color: "Unknown", description: "" }), item("found", { brand: "", model: "", color: "Unknown", description: "" }));
  assert.equal(thin.eligible, true);
  assert.ok(thin.score >= 50);
  const weaker = item("found", { id: id(12), description: "Unrelated scratches and broken hinge", date: "2026-10-25T12:00:00Z" });
  const list = [a, weaker, b, { ...b }];
  assert.equal(findMatches(list).filter(m => m.foundId === b.id).length, 1);
  assert.equal(findMatches(list)[0].foundId, b.id);
  assert.deepEqual(findMatches(list), findMatches([...list].reverse()));
  assert.deepEqual(Object.keys(calculateMatchScore(a, b)).sort(), ["id", "lostId", "foundId", "score", "factors", "distance", "minutes"].sort());
  for (const value of Object.values(calculateMatchScore(a, b).factors)) assert.equal(typeof value, "number");
});

test("no embedding/provider is invented by the optional scoring adapter", async () => {
  assert.equal(await generateImageEmbedding("synthetic-no-upload"), null);
  assert.equal((await extractItemAttributes("synthetic-no-upload")).confidence, 0);
});

test("active SQL and TypeScript agree on normalization, contradictions, ranking and future measured signals", async () => {
  const db = new PGlite();
  try {
    for (const file of ["001_student_backend.sql", "002_report_deletion.sql", "003_admin_portal.sql", "005_matching_engine.sql", "008_gemini_matching.sql", "009_match_threshold_50.sql", "010_forgiving_match_recalculation.sql", "011_phone_model_family.sql"])
      await db.exec(await readFile(new URL("../db/migrations/" + file, import.meta.url), "utf8"));
    assert.deepEqual((await db.query<any>("select matching_policy() p")).rows[0].p, matchingPolicy);
    for (const kind of ["brand", "color", "category"] as const) {
      for (const raw of [...Object.keys(matchingPolicy[kind]), ...matchingPolicy.unknown, "  UNKNOWN?  ", "constructor", "toString"]) {
        const sql = (await db.query<any>("select matching_attribute($1,$2) v", [kind, raw])).rows[0].v;
        assert.equal(sql, normalizeAttribute(kind, raw), `${kind}: ${raw}`);
      }
    }
    for (const raw of [...Object.keys(matchingPolicy.model), "Apple Air Pods Pro (2nd Gen)", "Pro", "Maybe AirPods", "Galaxy Buds 2 Pro"])
      assert.equal((await db.query<any>("select matching_model($1,'Apple','Wireless earbuds') v", [raw])).rows[0].v, normalizeModel(raw, "Apple", "Wireless earbuds"));
    const cases = [...scenarios, { name: "invalid date and coordinates", lost: { date: "invalid", lat: 100, lng: 200 }, eligible: true }];
    for (const s of cases) {
      const lost = item("lost", s.lost), found = item("found", s.found);
      for (const signals of [{}, { imageSimilarity: 1, semanticSimilarity: 0.8 }, { imageSimilarity: -1, semanticSimilarity: 2 }]) {
        const js = assessMatch(lost, found, signals);
        const sql = (await db.query<any>("select evaluate_report_match($1::jsonb,$2::jsonb,$3::jsonb) a", [JSON.stringify(lost), JSON.stringify(found), JSON.stringify(signals)])).rows[0].a;
        for (const key of ["eligible", "classification", "score", "factors", "minutes", "contradictions", "matchingFactors", "policyVersion"])
          assert.deepEqual(sql[key], js[key], `${s.name}: ${key}`);
        if (js.distance === null) assert.equal(sql.distance, null);
        else assert.ok(Math.abs(sql.distance - js.distance) < 1e-8);
      }
    }
  } finally { await db.close(); }
});

test("historical migration005 upgrades stale matches, preserves claims/dismissals, prevents duplicates and keeps reasoning private", async () => {
  const db = new PGlite();
  const q = async (sql: string, values: any[] = []) => (await db.query(sql, values)).rows as any[];
  const migration = await readFile(new URL("../db/migrations/005_matching_engine.sql", import.meta.url), "utf8");
  try {
    for (const file of ["001_student_backend.sql", "002_report_deletion.sql", "003_admin_portal.sql"])
      await db.exec(await readFile(new URL("../db/migrations/" + file, import.meta.url), "utf8"));
    await q("insert into users(id,email,display_name,role) values($1,'student@example.test','Student','student'),($2,'staff@example.test','Staff','admin'),($3,'other@example.test','Other','student')", [id(1), id(2), id(3)]);
    await q("insert into dropoff_zones(id,name,active) values($1,'Synthetic desk',true)", [id(4)]);
    const insert = async (i: MatchingItem) => q("insert into reports(id,reporter_id,report_type,category,item_name,brand,model,primary_color,description,lost_date,lost_time,occurred_at,status,dropoff_zone_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'2026-10-24','12:00',$10,$11,$12)", [i.id, i.reporterId, i.type, i.category, i.name, i.brand, i.model, i.color, i.description, i.date, i.status, i.type === "found" ? id(4) : null]);
    await insert(item("lost"));
    await insert(item("found", { brand: "Samsung", model: "Galaxy Buds 2" }));
    const [legacy] = await q("select * from potential_matches");
    assert.ok(legacy, "the old soft scorer suggested a contradictory pair");
    await q("insert into claims(match_id,claimant_id,answers) values($1,$2,'Synthetic private ownership evidence')", [legacy.id, id(1)]);
    const notices = (await q("select count(*)::int n from updates"))[0].n;
    const recoveryDefinitions = await q("select proname,pg_get_functiondef(oid) definition from pg_proc where proname in ('submit_ownership_claim','review_ownership_claim','redeem_pickup') order by proname");
    await db.exec(migration);
    const [upgraded] = await q("select * from potential_matches where id=$1", [legacy.id]);
    assert.equal(upgraded.dismissed, true);
    assert.equal(upgraded.score, 0);
    assert.equal(upgraded.staff_reasoning.classification, "no_match");
    assert.equal((await q("select count(*)::int n from claims"))[0].n, 1);
    assert.equal((await q("select count(*)::int n from updates"))[0].n, notices);
    assert.deepEqual(await q("select proname,pg_get_functiondef(oid) definition from pg_proc where proname in ('submit_ownership_claim','review_ownership_claim','redeem_pickup') order by proname"), recoveryDefinitions);
    // Compatible found item inserted after the lost report, then opposite order.
    await insert(item("found", { id: id(12) }));
    await insert(item("lost", { id: id(13), reporterId: id(3) }));
    const [match] = await q("select * from potential_matches where lost_report_id=$1 and found_report_id=$2", [id(10), id(12)]);
    assert.equal(match.score, assessMatch(item("lost"), item("found", { id: id(12) })).score);
    const staff = await adminRepository(q).workspace();
    assert.equal(staff.matches.find(m => m.id === match.id).staff_reasoning.policyVersion, "compatibility-v1");
    const own = await repository(q).workspace({ id: id(1) } as any);
    assert.equal("staff_reasoning" in own.state.matches.find(m => m.id === match.id), false);
    assert.ok(!JSON.stringify(own.state.matches).includes("contradictions"));
    const foreign = await repository(q).workspace({ id: id(3) } as any);
    assert.ok(!foreign.state.matches.some(m => m.lostId === id(10)));
    const [publicRow] = await q("select * from public_found_summaries limit 1");
    assert.ok(publicRow);
    assert.deepEqual(Object.keys(publicRow).sort(), ["id", "type", "category", "location", "date", "status"].sort());
    await q("update potential_matches set dismissed=true where id=$1", [match.id]);
    const counts = await q("select (select count(*) from potential_matches)::int matches,(select count(*) from updates)::int notices");
    for (let i = 0; i < 2; i++) {
      await q("update reports set description=description where id=$1", [id(12)]);
      await db.exec(migration);
    }
    assert.equal((await q("select dismissed from potential_matches where id=$1", [match.id]))[0].dismissed, true);
    assert.deepEqual(await q("select (select count(*) from potential_matches)::int matches,(select count(*) from updates)::int notices"), counts);
    await q("update reports set primary_color='Bright yellow' where id=$1", [id(12)]);
    assert.equal((await q("select score from potential_matches where id=$1", [match.id]))[0].score, 0);
    assert.equal((await q("select status from claims where match_id=$1", [legacy.id]))[0].status, "Pending");
  } finally { await db.close(); }
});
