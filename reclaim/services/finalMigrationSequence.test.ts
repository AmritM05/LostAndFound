// Local integration audit only. An explicit fixture directory permits reviewing
// pinned feature SQL in PGlite before a Git merge; it never connects to Neon.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { repository } from "../lib/server/repository";
const id = (n: number) => `77777777-7777-4777-8777-${String(n).padStart(12, "0")}`;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const names = ["001_student_backend.sql", "002_report_deletion.sql", "003_admin_portal.sql", "004_admin_recovery.sql", "005_matching_engine.sql", "006_pickup_reissue.sql"];
const folder = process.env.MAGPIE_SQL_AUDIT_DIRECTORY
  ? resolve(process.env.MAGPIE_SQL_AUDIT_DIRECTORY)
  : new URL("../db/migrations/", import.meta.url);
const read = (name: string) => readFile(typeof folder === "string" ? resolve(folder, name) : new URL(name, folder), "utf8");

test("final ordered SQL: contradiction rejection, private response, renewal, return and competing-claim protection", async t => {
  const existing = await readdir(folder);
  if (!names.every(name => existing.includes(name))) { t.skip("Final integration requires reviewed migrations 001–006"); return; }
  const db = new PGlite();
  const q = async (s: string, values: any[] = []) => (await db.query(s, values)).rows as any[];
  const definitions = () => q("select proname,prosrc from pg_proc where proname in ('submit_ownership_claim','review_ownership_claim','redeem_pickup') order by proname");
  try {
    for (const name of names.slice(0, 4)) await db.exec(await read(name));
    const guardDefinitions = await definitions();
    for (const name of names.slice(4)) await db.exec(await read(name));
    assert.deepEqual(await definitions(), guardDefinitions, "005/006 must not replace 004 recovery guards");
    for (const [n, role] of [[1, "student"], [2, "admin"], [3, "student"]])
      await q("insert into users(id,email,display_name,role) values($1,$2,'Synthetic participant',$3)", [id(Number(n)), `audit-${n}@example.test`, role]);
    await q("insert into buildings(id,campus_id,name,latitude,longitude) values('audit-library','audit','Audit Library',40,-83)");
    await q("insert into dropoff_zones(id,building_id,name,instructions,active) values($1,'audit-library','Public audit desk','Ask authorized staff',true)", [id(5)]);
    const base = { name: "Wireless earbuds", category: "Electronics", brand: "Apple", model: "AirPods Pro", color: "Black", description: "Black case with hidden green stitching and a small clip", features: "Black case with hidden green stitching and a small clip", locationKnown: false, date: new Date(Date.now()-3600000).toISOString() };
    await q("select save_student_report($1,$2::jsonb,'OWNER_PRIVATE_SENTINEL','{}'::uuid[],false)", [id(1), JSON.stringify({ ...base, id: id(10), type: "lost" })]);
    const found = async (n: number, extra = {}) => q("select save_found_report($1,$2::jsonb,'FOUND_PRIVATE_SENTINEL','{}'::uuid[])", [id(2), JSON.stringify({ ...base, id: id(n), type: "found", receivedAt: new Date().toISOString(), dropoffZoneId: id(5), custodyStatus: "Stored", staffNotes: "STAFF_PRIVATE_SENTINEL", ...extra })]);
    await found(11); await found(12);
    for (const [n, extra] of [[13, {brand:"Samsung",model:"Galaxy Buds"}], [14, {model:"AirPods Max"}], [15, {color:"White"}]] as const) {
      await found(n, extra);
      assert.equal((await q("select count(*)::int n from potential_matches where found_report_id=$1 and not dismissed", [id(n)]))[0].n, 0, `contradictory fixture ${n}`);
    }
    const matches = await q("select id,found_report_id from potential_matches where lost_report_id=$1 and not dismissed order by found_report_id", [id(10)]);
    assert.equal(matches.length, 2);
    for (const m of matches) await q("select submit_ownership_claim($1,$2,'Synthetic initial ownership evidence')", [id(1), m.id]);
    const claims = await q("select c.id,m.found_report_id from claims c join potential_matches m on m.id=c.match_id order by m.found_report_id");
    await q("select review_ownership_claim($1,$2,'More information',null,'','',$3)", [id(2),claims[0].id,"PRIVATE_REQUEST_SENTINEL: describe the hinge"]);
    await q("select submit_ownership_claim($1,$2,$3)", [id(1),matches[0].id,"PRIVATE_RESPONSE_SENTINEL: engraving under the hinge"]);
    assert.equal((await q("select status from claims where id=$1",[claims[0].id]))[0].status,"Pending");
    const owner = { id:id(1),role:"student",name:"Owner",email:"audit-1@example.test",verified:false } as const;
    const stranger = { ...owner,id:id(3) };
    const repo=repository(q);
    assert.ok((await repo.workspace(owner)).messages.some(n=>n.body.includes("PRIVATE_REQUEST_SENTINEL")));
    assert.equal((await repo.workspace(stranger)).state.claims.length,0);
    assert.equal((await repo.workspace(stranger)).messages.length,0);
    for(const summary of await repo.search()) assert.deepEqual(Object.keys(summary).sort(),["id","type","category","location","date","status"].sort());
    assert.ok(!JSON.stringify(await repo.search()).includes("SENTINEL"));
    const first="ABCDEF123456", renewed="123456ABCDEF";
    await q("select review_ownership_claim($1,$2,'Approved',$3,$4,$5,'Collect at the public desk')",[id(2),claims[0].id,id(5),first,hash(first)]);
    await assert.rejects(repo.deleteReport(owner,id(10)),/active recovery/);
    await q("update pickups set expires_at=now()-interval '1 second' where claim_id=$1",[claims[0].id]);
    const pickup=(await q("select id from pickups where claim_id=$1",[claims[0].id]))[0].id;
    assert.equal((await repo.workspace(owner)).state.claims.find(c=>c.id===claims[0].id)?.code,null);
    await q("select reissue_expired_pickup($1,$2,$3,$4,$5)",[id(2),pickup,id(5),renewed,hash(renewed)]);
    await assert.rejects(q("select redeem_pickup($1,$2)",[id(2),hash(first)]));
    assert.equal((await repo.workspace(owner)).state.claims.find(c=>c.id===claims[0].id)?.code,renewed);
    await q("select redeem_pickup($1,$2)",[id(2),hash(renewed)]);
    await assert.rejects(q("select redeem_pickup($1,$2)",[id(2),hash(renewed)]));
    await assert.rejects(q("select review_ownership_claim($1,$2,'Approved',$3,$4,$5,'Stale approval')",[id(2),claims[1].id,id(5),first,hash(first)]));
    assert.deepEqual((await q("select status from reports where id=any($1::uuid[])",[[id(10),id(11)]])).map(r=>r.status),["Returned","Returned"]);
    assert.equal((await q("select count(*)::int n from pickups"))[0].n,1);
    for(const name of names) await db.exec(await read(name));
    assert.deepEqual(await definitions(),guardDefinitions,"ordered replay preserves guard definitions");
    assert.equal((await q("select status from reports where id=$1",[id(10)]))[0].status,"Returned");
  } finally { await db.close(); }
});
