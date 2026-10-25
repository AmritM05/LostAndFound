// ISOLATED: production repositories and SQL in PGlite; synthetic identity/photo
// metadata. No HTTP login, Neon, Blob bytes or live service access is tested here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { repository } from "../lib/server/repository";
import { adminRepository } from "../lib/server/adminRepository";
import { tokenHash } from "../lib/server/adminSession";
import type { Item, Profile } from "../lib/types";
import { GET as adminWorkspace } from "../app/api/admin/workspace/route";
import { POST as adminIntake } from "../app/api/admin/reports/route";
import { POST as adminAction } from "../app/api/admin/actions/route";
import { GET as image } from "../app/api/images/[id]/route";
const id = (n: number) => `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`;
const profile = (n: number): Profile => ({ id: id(n), email: `student-${n}@example.com`, name: "Synthetic participant", role: "student", verified: false });
const report = (n: number, type = "lost") => ({
  id: id(n), type, name: "Synthetic black wallet", category: "Wallet", brand: "", model: "", color: "Black",
  description: "Leather wallet with a hidden blue stitch", features: "Leather wallet with a hidden blue stitch", locationKnown: false,
  date: new Date(Date.now() - 3600000).toISOString(), receivedAt: new Date().toISOString(),
  dropoffZoneId: id(5), custodyStatus: "Received", staffNotes: "STAFF_STORAGE_SENTINEL",
}) as Item;

test("student cookies cannot authorize staff APIs or staff-photo scope", async () => {
  const root = "http://localhost:3000";
  const headers = { origin: root, cookie: "magpie_demo_session=" + "a".repeat(64), "content-type": "application/json" };
  assert.equal((await adminWorkspace(new Request(root + "/api/admin/workspace/", { headers }))).status, 401);
  for (const handler of [adminIntake, adminAction]) assert.equal((await handler(new Request(root + "/api/admin/actions/", { method: "POST", headers, body: "{}" }))).status, 401);
  assert.equal((await image(new Request(root + `/api/images/${id(6)}/?workspace=admin`, { headers }), { params: Promise.resolve({ id: id(6) }) })).status, 401);
});

test("isolated student integration: private evidence through information request, approval and return", async t => {
  const db = new PGlite();
  const q = async (sql: string, values: any[] = []) => (await db.query(sql, values)).rows as any[];
  const folder = new URL("../db/migrations/", import.meta.url);
  const migrations = (await readdir(folder)).filter(n => n.endsWith(".sql")).sort();
  try {
    for (const name of migrations) await db.exec(await readFile(new URL(name, folder), "utf8"));
    for (const n of [1, 2, 3]) await q("insert into users(id,email,display_name,role) values($1,$2,'Synthetic participant',$3)", [id(n), profile(n).email, n === 3 ? "admin" : "student"]);
    await q("insert into buildings(id,campus_id,name,latitude,longitude) values('test-library','fixture-campus','Sample Library',40,-83)");
    await q("insert into dropoff_zones(id,building_id,name,instructions,active,latitude,longitude) values($1,'test-library','Public intake desk','Ask campus staff during desk hours',true,40,-83)", [id(5)]);
    for (const [n, owner, role] of [[6, 1, "student"], [7, 3, "admin"]] as const)
      await q("insert into report_images(id,owner_id,filename,mime_type,byte_size,blob_pathname,blob_url,status,upload_role) values($1,$2,'synthetic.png','image/png',68,$3,$4,'uploaded',$5)", [id(n), id(owner), `fixture/${n}.png`, `https://fixture.private.blob.vercel-storage.com/fixture/${n}.png`, role]);
    const student = repository(q), admin = adminRepository(q), owner = profile(1), stranger = profile(2), lost = report(10), found = report(11, "found");
    let match: any, secondMatch: any, claimId = "", secondClaimId = "";
    await t.test("lost report binds synthetic image metadata; students cannot save FOUND", async () => {
      await student.save(owner, lost, "OWNER_EVIDENCE_SENTINEL", [id(6)]);
      await assert.rejects(student.save(owner, report(20, "found"), "", []), /only create lost/);
      const snapshot = await student.workspace(owner);
      assert.deepEqual(snapshot.state.items[0].imagePaths, [id(6)]);
      assert.equal(snapshot.state.items[0].locationKnown, false);
      assert.ok(!JSON.stringify(snapshot).includes("blob.vercel-storage.com"));
    });
    await t.test("staff intake generates compatible candidates without exposing found photos", async () => {
      await admin.saveFound(id(3), { item: found, privateDetail: "FOUND_UNIQUE_SENTINEL", imageIds: [id(7)] });
      await admin.saveFound(id(3), { item: report(12, "found"), privateDetail: "FOUND_SECOND_SENTINEL", imageIds: [] });
      const snapshot = await student.workspace(owner);
      match = snapshot.state.matches.find(m => m.foundId === found.id);
      secondMatch = snapshot.state.matches.find(m => m.foundId === id(12));
      assert.ok(match && secondMatch, "compatible SQL candidate fixtures must exist");
      assert.ok(!JSON.stringify(snapshot).includes(id(7)));
      assert.ok(!JSON.stringify(snapshot).includes("FOUND_UNIQUE_SENTINEL"));
    });
    await t.test("public search has exactly six fields and no evidence, staff storage or image URLs", async () => {
      const rows = await student.search();
      assert.equal(rows.length, 2);
      for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ["id", "type", "category", "location", "date", "status"].sort());
      for (const forbidden of ["SENTINEL", "blob.vercel-storage", "imagePaths", "/api/images/", "answers", "report_notes", "Synthetic black wallet"]) assert.ok(!JSON.stringify(rows).includes(forbidden), forbidden);
    });
    await t.test("foreign deletion/claims fail; active claims protect owner deletion", async () => {
      assert.equal(await student.deleteReport(stranger, lost.id), false);
      assert.equal((await q("select count(*)::int as n from reports where id=$1", [lost.id]))[0].n, 1);
      await assert.rejects(q("select submit_ownership_claim($1,$2,$3)", [stranger.id, match.id, "FOREIGN_EVIDENCE_SENTINEL"]), /Match unavailable/);
      claimId = (await q("select submit_ownership_claim($1,$2,$3) as id", [owner.id, match.id, "FIRST_EVIDENCE_SENTINEL"]))[0].id;
      secondClaimId = (await q("select submit_ownership_claim($1,$2,$3) as id", [owner.id, secondMatch.id, "SECOND_EVIDENCE_SENTINEL"]))[0].id;
      await assert.rejects(student.deleteReport(owner, lost.id), /active recovery/);
    });
    await t.test("private staff request and updated answer reach staff, not unrelated users/search", async () => {
      await admin.review(id(3), { id: claimId, status: "More information", message: "REQUEST_SENTINEL: describe hidden stitching" }, "", tokenHash(""));
      const requested = await student.workspace(owner);
      assert.equal(requested.state.claims.find(c => c.id === claimId)?.status, "More information");
      assert.ok(requested.messages.some(n => n.body.includes("REQUEST_SENTINEL")));
      await q("select submit_ownership_claim($1,$2,$3)", [owner.id, match.id, "RESPONSE_SENTINEL: hidden blue stitching inside the pocket"]);
      const staff = await admin.workspace();
      assert.equal(staff.claims.find(c => c.id === claimId)?.status, "Pending");
      assert.match(staff.claims.find(c => c.id === claimId)?.answers, /RESPONSE_SENTINEL/);
      const unrelated = await student.workspace(stranger);
      assert.equal(unrelated.state.claims.length, 0);
      assert.equal(unrelated.messages.length, 0);
      assert.ok(!JSON.stringify(unrelated).includes("SENTINEL"));
      assert.ok(!JSON.stringify(await student.search()).includes("SENTINEL"));
    });
    await t.test("owner-only pass and single-use pickup mark both reports Returned", async () => {
      const code = "SYNTHETIC123";
      await admin.review(id(3), { id: claimId, status: "Approved", zoneId: id(5), message: "Collect at the public desk" }, code, tokenHash(code));
      const approved = await student.workspace(owner);
      assert.equal(approved.state.claims.find(c => c.id === claimId)?.code, code);
      assert.equal(approved.state.claims.find(c => c.id === claimId)?.pickupLocation, "Public intake desk");
      assert.ok(!JSON.stringify(await student.workspace(stranger)).includes(code));
      await assert.rejects(student.deleteReport(owner, lost.id), /active recovery/);
      await admin.redeem(id(3), tokenHash(code));
      await assert.rejects(admin.redeem(id(3), tokenHash(code)));
      assert.deepEqual((await q("select status from reports where id=any($1::uuid[])", [[lost.id, found.id]])).map(r => r.status), ["Returned", "Returned"]);
      assert.equal((await student.workspace(owner)).state.claims.find(c => c.id === claimId)?.code, null);
    });
    await t.test("competing claim cannot reopen Returned (requires reviewed migration 004)", { skip: !migrations.includes("004_admin_recovery.sql") && "Pending Developer 2 migration 004; baseline 003 has MAG-008 defect" }, async () => {
      await assert.rejects(admin.review(id(3), { id: secondClaimId, status: "Approved", zoneId: id(5), message: "Stale decision" }, "STALE123", tokenHash("STALE123")));
      assert.equal((await q("select status from reports where id=$1", [lost.id]))[0].status, "Returned");
      assert.equal((await q("select count(*)::int as n from pickups"))[0].n, 1);
    });
  } finally { await db.close(); }
});
for (const attribute of ["brand", "model", "color"])
  test.todo(`hard ${attribute} contradiction persistence acceptance: pending Developer 3 MAG-001/002 contract and approved matching migration`);
