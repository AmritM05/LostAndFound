import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { adminRepository } from "../lib/server/adminRepository";
import { repository } from "../lib/server/repository";
import { POST as actions } from "../app/api/admin/actions/route";
import {
  pickupState,
  claimReviewable,
} from "../components/admin/recoveryState";
import { execFileSync } from "node:child_process";

const id = (n: number) =>
  `66666666-6666-4666-8666-${String(n).padStart(12, "0")}`;
const hash = (code: string) => createHash("sha256").update(code).digest("hex");
const originalCode = "ABCDEF123456",
  nextCode = "123456ABCDEF";
async function fixture() {
  const db = new PGlite();
  const q = async (sql: string, values: any[] = []) =>
    (await db.query(sql, values)).rows as any[];
  const directory = new URL("../db/migrations/", import.meta.url);
  const migrate = async () => {
    for (const file of (await readdir(directory))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(new URL(file, directory), "utf8"));
  };
  await migrate();
  await q(
    "insert into users(id,email,display_name,role) values($1,'owner@example.test','Owner','student'),($2,'staff@example.test','Staff','admin'),($3,'other@example.test','Other','student')",
    [id(1), id(2), id(3)],
  );
  await q(
    "insert into dropoff_zones(id,name,active) values($1,'Original desk',true),($2,'New desk',true),($3,'Closed desk',false)",
    [id(4), id(5), id(6)],
  );
  await db.exec("drop trigger reports_match on reports");
  for (const [n, type, owner] of [
    [10, "lost", 1],
    [11, "found", 2],
    [12, "found", 2],
  ] as const)
    await q(
      "insert into reports(id,reporter_id,report_type,category,item_name,lost_date,lost_time,occurred_at,status,custody_status) values($1,$2,$3,'Other','Synthetic item',current_date,current_time,now(),$4,$5)",
      [
        id(n),
        id(owner),
        type,
        type === "lost" ? "Matching" : "Secured",
        type === "found" ? "Stored" : null,
      ],
    );
  for (const [n, found] of [
    [20, 11],
    [21, 12],
  ]) {
    await q(
      "insert into potential_matches(id,lost_report_id,found_report_id,score) values($1,$2,$3,80)",
      [id(n), id(10), id(found)],
    );
    await q(
      "select submit_ownership_claim($1,$2,'Synthetic private ownership evidence')",
      [id(1), id(n)],
    );
  }
  const [claim] = await q("select id from claims where match_id=$1", [id(20)]);
  const admin = adminRepository(q);
  await admin.review(
    id(2),
    { id: claim.id, status: "Approved", zoneId: id(4) },
    originalCode,
    hash(originalCode),
  );
  const [pickup] = await q("select id from pickups where claim_id=$1", [
    claim.id,
  ]);
  const renew = (code = nextCode, staff = id(2), zone = id(5)) =>
    admin.reissue(staff, pickup.id, zone, code, hash(code));
  const expire = () =>
    q(
      "update pickups set expires_at=now()-interval '1 second',token_hash='legacy-token' where id=$1",
      [pickup.id],
    );
  return {
    db,
    q,
    admin,
    claimId: claim.id,
    pickupId: pickup.id,
    renew,
    expire,
    migrate,
  };
}

test("expired pickup remains assigned, renews once privately and invalidates the old credential", async () => {
  const f = await fixture();
  try {
    await f.expire();
    const reports = await f.q("select * from reports order by id");
    const auditBeforeReads = await f.q(
      "select count(*)::int n from staff_activity",
    );
    for (let n = 0; n < 3; n++) {
      const read = await f.admin.workspace();
      assert.equal(
        pickupState(
          read.pickups[0],
          read.claims.find((c) => c.id === f.claimId),
          read.matches.find((m) => m.id === id(20)),
          read.reports,
        ),
        "Expired",
      );
    }
    assert.deepEqual(
      await f.q("select count(*)::int n from staff_activity"),
      auditBeforeReads,
    );
    assert.deepEqual(await f.q("select * from reports order by id"), reports);
    const owner = repository(f.q);
    let workspace = await owner.workspace({ id: id(1) } as any);
    assert.equal(
      workspace.state.claims.find((c) => c.id === f.claimId).code,
      null,
    );
    await assert.rejects(
      f.admin.redeem(id(2), hash(originalCode)),
      /invalid or expired/,
    );
    const [pass] = await f.q("select * from pickups");
    assert.equal(pass.used_at, null);
    assert.equal(
      (await f.q("select status from claims where id=$1", [f.claimId]))[0]
        .status,
      "Approved",
    );
    await f.renew();
    assert.deepEqual(await f.q("select * from reports order by id"), reports);
    const [renewed] = await f.q("select * from pickups");
    assert.equal(renewed.id, pass.id);
    assert.equal(renewed.code_hash, hash(nextCode));
    assert.equal(renewed.token_hash, null);
    assert.equal(renewed.used_at, null);
    assert.equal(renewed.zone_id, id(5));
    assert.ok(
      new Date(renewed.expires_at).getTime() > Date.now() + 6 * 86400000,
    );
    assert.equal((await f.q("select count(*)::int n from pickups"))[0].n, 1);
    const audit = await f.q(
      "select (select count(*) from updates)::int notices,(select count(*) from staff_activity)::int activity",
    );
    await assert.rejects(f.renew("AAAAAAAAAAAA"), /cannot be reissued/);
    assert.deepEqual(
      await f.q(
        "select (select count(*) from updates)::int notices,(select count(*) from staff_activity)::int activity",
      ),
      audit,
    );
    workspace = await owner.workspace({ id: id(1) } as any);
    const claim = workspace.state.claims.find((c) => c.id === f.claimId);
    assert.equal(claim.code, nextCode);
    assert.equal(claim.pickupLocation, "New desk");
    assert.ok(
      workspace.state.notices.some(
        (n) => n.title === "Pickup pass renewed" && n.message.includes("UTC"),
      ),
    );
    const foreign = await owner.workspace({ id: id(3) } as any);
    assert.equal(foreign.state.claims.length, 0);
    assert.ok(
      !foreign.state.notices.some((n) => n.title === "Pickup pass renewed"),
    );
    await assert.rejects(
      f.admin.redeem(id(2), hash(originalCode)),
      /invalid or expired/,
    );
    const [competitor] = await f.q("select id from claims where match_id=$1", [
      id(21),
    ]);
    await assert.rejects(
      f.admin.review(
        id(2),
        { id: competitor.id, status: "Approved", zoneId: id(4) },
        "BBBBBBBBBBBB",
        hash("BBBBBBBBBBBB"),
      ),
      /already assigned/,
    );
    await f.admin.redeem(id(2), hash(nextCode));
    await assert.rejects(f.renew("CCCCCCCCCCCC"), /cannot be reissued/);
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

test("completed pickups never expire retroactively; active, terminal, dismissed and unauthorized renewal fails", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.renew(), /cannot be reissued/);
    await f.expire();
    await assert.rejects(f.renew(originalCode), /cannot be reissued/);
    await assert.rejects(f.renew("invalid"), /cannot be reissued/);
    await assert.rejects(f.renew(nextCode, id(1)), /Access denied/);
    await assert.rejects(
      f.renew(nextCode, id(2), id(6)),
      /active drop-off zone/,
    );
    for (const report of [10, 11]) {
      for (const status of ["Returned", "Archived"]) {
        await f.q("update reports set status=$2 where id=$1", [
          id(report),
          status,
        ]);
        await assert.rejects(f.renew(), /cannot be reissued/);
      }
      await f.q("update reports set status='Ready for Pickup' where id=$1", [
        id(report),
      ]);
    }
    await f.q("update potential_matches set dismissed=true where id=$1", [
      id(20),
    ]);
    await assert.rejects(f.renew(), /cannot be reissued/);
    await f.q("update potential_matches set dismissed=false where id=$1", [
      id(20),
    ]);
    await f.renew();
    await f.admin.redeem(id(2), hash(nextCode));
    await f.q("update pickups set expires_at=now()-interval '1 day'");
    const before = await f.q("select * from reports order by id");
    const workspace = await f.admin.workspace();
    assert.equal(
      pickupState(
        workspace.pickups[0],
        workspace.claims.find((c) => c.id === f.claimId),
        workspace.matches.find((m) => m.id === id(20)),
        workspace.reports,
      ),
      "Returned",
    );
    await assert.rejects(f.renew("DDDDDDDDDDDD"), /cannot be reissued/);
    assert.deepEqual(await f.q("select * from reports order by id"), before);
    assert.equal(
      (
        await f.q(
          "select count(*)::int n from pickups where used_at is not null",
        )
      )[0].n,
      1,
    );
  } finally {
    await f.db.close();
  }
});

test("missing deadlines are repairable and queued renewal calls cannot issue two passes", async () => {
  const f = await fixture();
  try {
    await f.q("update pickups set expires_at=null");
    const results = await Promise.allSettled([
      f.renew(),
      f.renew("EEEEEEEEEEEE"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (
        await f.q(
          "select count(*)::int n from staff_activity where action='Renewed expired pickup pass'",
        )
      )[0].n,
      1,
    );
    assert.equal(
      (
        await f.q(
          "select count(*)::int n from updates where title='Pickup pass renewed'",
        )
      )[0].n,
      1,
    );
    // PGlite queues one connection; real independent PostgreSQL contention is not certified.
    const redemption = await Promise.allSettled([
      f.admin.redeem(id(2), hash(nextCode)),
      f.admin.redeem(id(2), hash(nextCode)),
    ]);
    assert.equal(redemption.filter((r) => r.status === "fulfilled").length, 1);
  } finally {
    await f.db.close();
  }
});

test("migration replay retains renewal and terminal recovery guards", async () => {
  const f = await fixture();
  try {
    await f.migrate();
    await f.expire();
    await f.renew();
    await f.admin.redeem(id(2), hash(nextCode));
    const [competitor] = await f.q("select id from claims where match_id=$1", [
      id(21),
    ]);
    await assert.rejects(
      f.admin.review(
        id(2),
        { id: competitor.id, status: "Approved", zoneId: id(4) },
        "FFFFFFFFFFFF",
        hash("FFFFFFFFFFFF"),
      ),
      /cannot be changed/,
    );
  } finally {
    await f.db.close();
  }
});

test("pickup labels distinguish expired, unknown, closed and collected states at the deadline boundary", () => {
  const now = Date.parse("2026-10-24T12:00:00Z");
  const claim = { id: id(30), match_id: id(20), status: "Approved" };
  const match = { id: id(20), lost_report_id: id(10), found_report_id: id(11) };
  const reports = [10, 11].map((n) => ({
    id: id(n),
    status: "Ready for Pickup",
  }));
  const pickup = {
    id: id(40),
    claim_id: claim.id,
    expires_at: new Date(now).toISOString(),
  };
  assert.equal(pickupState(pickup, claim, match, reports, now), "Expired");
  assert.equal(
    pickupState(pickup, claim, match, reports, now - 1),
    "Ready for Pickup",
  );
  assert.equal(
    pickupState({ ...pickup, expires_at: null }, claim, match, reports, now),
    "Deadline unavailable",
  );
  assert.equal(
    pickupState(
      { ...pickup, expires_at: "invalid" },
      claim,
      match,
      reports,
      now,
    ),
    "Deadline unavailable",
  );
  assert.equal(
    pickupState(
      { ...pickup, used_at: "2026-10-23" },
      claim,
      match,
      reports,
      now,
    ),
    "Returned",
  );
  assert.equal(
    pickupState(
      pickup,
      claim,
      match,
      [{ id: id(10), status: "Archived" }, reports[1]],
      now,
    ),
    "Closed",
  );
  assert.equal(
    pickupState(pickup, undefined, match, reports, now),
    "Needs review",
  );
  assert.equal(
    claimReviewable({ ...claim, status: "Pending" }, match, reports),
    false,
  );
  assert.equal(
    claimReviewable(
      { ...claim, status: "Pending" },
      match,
      reports.map((r) => ({ ...r, status: "Matching" })),
    ),
    true,
  );
  assert.equal(
    claimReviewable(
      { ...claim, status: "More information" },
      undefined,
      reports,
    ),
    false,
  );
});

test("renewal HTTP action rejects student cookies and foreign origins before database access", async () => {
  for (const origin of ["http://localhost:3000", "https://foreign.example"]) {
    const response = await actions(
      new Request("http://localhost:3000/api/admin/actions/", {
        method: "POST",
        headers: { origin, cookie: "magpie_demo_session=" + "a".repeat(64) },
        body: JSON.stringify({
          action: "reissuePickup",
          id: id(40),
          zoneId: id(5),
        }),
      }),
    );
    assert.equal(
      response.status,
      origin.startsWith("http://localhost") ? 401 : 403,
    );
  }
});

test("admin pickup markup hides expired codes and never offers renewal for returned records", () => {
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
    import React from 'react'; globalThis.React=React;
    import {renderToStaticMarkup as render} from 'react-dom/server';
    import assert from 'node:assert/strict';
    import Module from './components/admin/PickupRecord.tsx';
    const Record=Module.default||Module;
    const props={pickup:{id:'sample',claim_id:'claim',expires_at:'2026-10-20',display_code:'PRIVATEOLD12'},itemName:'Sample bag',claimant:'sample@example.test',zones:[{id:'zone',name:'Desk'}],busy:false,renew:async()=>{}};
    const expired=render(React.createElement(Record,{...props,status:'Expired'}));
    assert.ok(expired.includes('Renew pickup pass'));assert.ok(expired.includes('does not mark it Returned'));assert.ok(!expired.includes('PRIVATEOLD12'));
    for(const status of ['Returned','Closed','Needs review']){
      const html=render(React.createElement(Record,{...props,status}));
      assert.ok(!html.includes('Renew pickup pass'));assert.ok(!html.includes('PRIVATEOLD12'));
    }
    const empty=render(React.createElement(Record,{...props,status:'Expired',zones:[]}));assert.ok(empty.includes('Activate a pickup location'));
  `,
    ],
    { cwd: new URL("..", import.meta.url), stdio: "pipe" },
  );
});
