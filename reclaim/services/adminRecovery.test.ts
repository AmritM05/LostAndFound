import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { adminRepository } from "../lib/server/adminRepository";
import { repository } from "../lib/server/repository";
import { POST as actions } from "../app/api/admin/actions/route";

const id = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
async function fixture() {
  const db = new PGlite();
  const q = async (sql: string, values: any[] = []) => (await db.query(sql, values)).rows as any[];
  const directory = new URL("../db/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter(f => f.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  // The migration runner replays files; the final recovery definitions must survive replay.
  await db.exec(await readFile(new URL("004_admin_recovery.sql", directory), "utf8"));
  await q("insert into users(id,email,display_name,role) values($1,'owner@example.test','Owner','student'),($2,'staff@example.test','Staff','admin'),($3,'other@example.test','Other','student')", [id(1), id(2), id(3)]);
  await q("insert into dropoff_zones(id,name,active) values($1,'Desk',true)", [id(4)]);
  // Explicit matches isolate recovery from Developer 3's scoring policy.
  await db.exec("drop trigger reports_match on reports");
  for (const [n, type, owner] of [[10, "lost", 1], [11, "found", 2], [12, "found", 2], [13, "lost", 3]] as const)
    await q("insert into reports(id,reporter_id,report_type,category,item_name,lost_date,lost_time,occurred_at,status,custody_status) values($1,$2,$3,'Other','Synthetic item',current_date,current_time,now(),$4,$5)", [id(n), id(owner), type, type === "lost" ? "Matching" : "Secured", type === "found" ? "Stored" : null]);
  for (const [n, lost, found, owner] of [[20, 10, 11, 1], [21, 10, 12, 1], [22, 13, 11, 3]]) {
    await q("insert into potential_matches(id,lost_report_id,found_report_id,score) values($1,$2,$3,80)", [id(n), id(lost), id(found)]);
    await q("select submit_ownership_claim($1,$2,'Original private ownership answer')", [id(owner), id(n)]);
  }
  const claims = await q("select id,match_id from claims");
  const claim = (match: number) => claims.find(c => c.match_id === id(match)).id;
  const admin = adminRepository(q);
  const review = (match: number, status = "Approved", message = "", staff = 2) => admin.review(id(staff), { id: claim(match), status, zoneId: id(4), message }, `CODE${match}`, `HASH${match}`);
  return { db, q, claim, review, admin };
}

test("terminal return survives competing, duplicate and invalid recovery actions", async () => {
  const { db, q, claim, review, admin } = await fixture();
  try {
    await assert.rejects(review(20, "Approved", "", 1), /Access denied/);
    await assert.rejects(review(20, "Returned"), /cannot be changed/);
    await review(20);
    assert.equal((await q("select status from claims where id=$1", [claim(20)]))[0].status, "Approved");
    assert.equal((await q("select count(*)::int n from reports where status='Ready for Pickup'"))[0].n, 2);
    await assert.rejects(review(21), /already assigned/);
    await assert.rejects(review(22), /already assigned/);
    await assert.rejects(review(20), /cannot be changed/);
    await assert.rejects(q("select submit_ownership_claim($1,$2,'A new ownership answer')", [id(1), id(21)]), /unavailable/);
    await assert.rejects(admin.redeem(id(1), "HASH20"), /Access denied/);
    await admin.redeem(id(2), "HASH20");
    const before = await q("select * from reports order by id");
    const auditBefore = await q("select (select count(*) from updates)::int notices,(select count(*) from staff_activity)::int activity");
    for (const match of [20, 21, 22])
      for (const status of ["Approved", "Rejected", "More information"])
        await assert.rejects(review(match, status, "Private request"), /cannot be changed/);
    await assert.rejects(admin.redeem(id(2), "HASH20"), /invalid or expired/);
    assert.deepEqual(await q("select * from reports order by id"), before);
    assert.deepEqual(await q("select (select count(*) from updates)::int notices,(select count(*) from staff_activity)::int activity"), auditBefore);
    assert.equal((await q("select status from claims where id=$1", [claim(20)]))[0].status, "Returned");
    assert.equal((await q("select count(*)::int n from reports where status='Returned'"))[0].n, 2);
    assert.equal((await q("select count(*)::int n from claims"))[0].n, 3);
    assert.equal((await q("select count(*)::int n from pickups"))[0].n, 1);
  } finally { await db.close(); }
});

test("information request is private, validated, resubmitted to Pending and reviewable", async () => {
  const { db, q, claim, review, admin } = await fixture();
  try {
    await assert.rejects(review(20, "More information", "  "), /private information request/);
    await assert.rejects(review(20, "More information", "x".repeat(2001)), /private information request/);
    await review(20, "More information", "Describe the inner pocket");
    const student = repository(q);
    const owner: any = { id: id(1) }, other: any = { id: id(3) };
    assert.equal((await student.workspace(owner)).state.claims.find(c => c.id === claim(20)).status, "More information");
    assert.ok((await student.workspace(owner)).state.notices.some(n => n.message.includes("Describe the inner pocket")));
    assert.ok(!(await student.workspace(other)).messages.some(n => n.body.includes("Describe the inner pocket")));
    await assert.rejects(q("select submit_ownership_claim($1,$2,$3)", [id(3), id(20), "A foreign response"]), /unavailable/);
    for (const answer of ["short", "x".repeat(1501), null])
      await assert.rejects(q("select submit_ownership_claim($1,$2,$3)", [id(1), id(20), answer]), /ownership details/);
    await q("select submit_ownership_claim($1,$2,$3)", [id(1), id(20), "Updated private pocket description"]);
    const staff = await admin.workspace();
    assert.equal(staff.claims.find(c => c.id === claim(20)).status, "Pending");
    assert.equal(staff.claims.find(c => c.id === claim(20)).answers, "Updated private pocket description");
    assert.ok(staff.notes.some(n => n.body === "Original private ownership answer"));
    await review(20);
    await admin.redeem(id(2), "HASH20");
  } finally { await db.close(); }
});

test("archived reports and inconsistent pickup states reject transitions atomically", async () => {
  const { db, q, review, admin } = await fixture();
  try {
    await q("update potential_matches set dismissed=true where id=$1", [id(20)]);
    await assert.rejects(review(20), /cannot be changed/);
    await q("update potential_matches set dismissed=false where id=$1", [id(20)]);
    for (const report of [10, 11]) {
      await q("update reports set status='Archived' where id=$1", [id(report)]);
      for (const status of ["Approved", "Rejected", "More information"])
        await assert.rejects(review(20, status, "Explain ownership"), /cannot be changed/);
      await q("update reports set status='Matching' where id=$1", [id(report)]);
    }
    await review(20);
    await q("update pickups set expires_at=now()-interval '1 second'");
    await assert.rejects(admin.redeem(id(2), "HASH20"), /invalid or expired/);
    await q("update pickups set expires_at=null");
    await assert.rejects(admin.redeem(id(2), "HASH20"), /invalid or expired/);
    await q("update pickups set expires_at=now()+interval '1 day'");
    await q("update reports set status='Archived' where id=$1", [id(10)]);
    await assert.rejects(admin.redeem(id(2), "HASH20"), /invalid or expired/);
    assert.equal((await q("select used_at from pickups"))[0].used_at, null);
  } finally { await db.close(); }
});

test("queued competing approvals and duplicate redemptions have one successful result", async () => {
  // PGlite queues calls in one PostgreSQL session; this checks overlapping callers,
  // not independent Neon connections or PostgreSQL lock contention.
  const { db, q, review, admin } = await fixture();
  try {
    const approvals = await Promise.allSettled([review(20), review(21), review(22)]);
    assert.equal(approvals.filter(r => r.status === "fulfilled").length, 1);
    const pickups = await Promise.allSettled([admin.redeem(id(2), "HASH20"), admin.redeem(id(2), "HASH20")]);
    assert.equal(pickups.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await q("select count(*)::int n from reports where status='Returned'"))[0].n, 2);
  } finally { await db.close(); }
});

test("claim decisions and pickup HTTP requests require a staff session", async () => {
  for (const payload of [{ action: "reviewClaim", id: id(20), status: "Approved" }, { action: "reviewClaim", id: id(20), status: "Rejected" }, { action: "reviewClaim", id: id(20), status: "More information", message: "Private request" }, { action: "pickup", code: "AABBCCDDEEFF" }]) {
    const response = await actions(new Request("http://localhost:3000/api/admin/actions/", { method: "POST", headers: { origin: "http://localhost:3000", cookie: "magpie_demo_session=" + "a".repeat(64) }, body: JSON.stringify(payload) }));
    assert.equal(response.status, 401);
  }
});
