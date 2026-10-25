import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import { adminRepository } from "../lib/server/adminRepository";
import { repository } from "../lib/server/repository";
import { listStudentDropoffs } from "../lib/server/studentDropoffs";

const matchingPath =
  process.env.MAGPIE_MATCHING_MIGRATION_REVIEW_PATH ||
  new URL("../db/migrations/005_matching_engine.sql", import.meta.url);
const available = existsSync(matchingPath);
const id = (n: number) =>
  `88888888-8888-4888-8888-${String(n).padStart(12, "0")}`;
const hash = (code: string) => createHash("sha256").update(code).digest("hex");

test(
  "ordered 004+005+006+007 preserves recovery, private responses, matching projection and publication on replay",
  {
    skip: available
      ? false
      : "Reviewed 005 is on the matching branch. Integrate it or provide MAGPIE_MATCHING_MIGRATION_REVIEW_PATH for isolated verification.",
  },
  async () => {
    const db = new PGlite();
    const q = async (sql: string, values: any[] = []) =>
      (await db.query(sql, values)).rows as any[];
    const directory = new URL("../db/migrations/", import.meta.url);
    const recoveryDefs = () =>
      q(
        "select proname,prosrc from pg_proc where proname in ('submit_ownership_claim','review_ownership_claim','redeem_pickup') order by proname",
      );
    try {
      const filenames = [
        "001_student_backend.sql",
        "002_report_deletion.sql",
        "003_admin_portal.sql",
        "004_admin_recovery.sql",
        "005_matching_engine.sql",
        "006_pickup_reissue.sql",
        "007_student_dropoff_visibility.sql",
      ];
      const sources = await Promise.all(
        filenames.map((name) =>
          readFile(
            name.startsWith("005_") ? matchingPath : new URL(name, directory),
            "utf8",
          ),
        ),
      );
      for (let n = 0; n < 4; n++) await db.exec(sources[n]);
      const before = await recoveryDefs();
      await db.exec(sources[4]);
      assert.deepEqual(
        await recoveryDefs(),
        before,
        "005 must not replace recovery functions",
      );
      await db.exec(sources[5]);
      await db.exec(sources[6]);
      const columns = await q(
        "select table_name,column_name from information_schema.columns where (table_name='potential_matches' and column_name='staff_reasoning') or (table_name='dropoff_zones' and column_name in ('student_visible','public_instructions'))",
      );
      assert.equal(columns.length, 3);
      await q(
        "insert into users(id,email,display_name,role) values($1,'owner@example.test','Owner','student'),($2,'staff@example.test','Staff','admin'),($3,'other@example.test','Other','student')",
        [id(1), id(2), id(3)],
      );
      await q(
        "insert into buildings(id,campus_id,name,latitude,longitude) values('public','demo-campus','Public hall',40,-83)",
      );
      await q(
        "insert into dropoff_zones(id,name,building_id,active,student_visible,public_instructions,instructions) values($1,'Public desk','public',true,true,'Hand items to reception','PRIVATE STORAGE')",
        [id(4)],
      );
      // Explicit pairs isolate recovery transitions from the teammate's ranking policy.
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
          'insert into potential_matches(id,lost_report_id,found_report_id,score,staff_reasoning) values($1,$2,$3,80,\'{"private_reason":"STAFF ONLY"}\')',
          [id(n), id(10), id(found)],
        );
        await q(
          "select submit_ownership_claim($1,$2,'Original private ownership evidence')",
          [id(1), id(n)],
        );
      }
      const [claim] = await q("select id from claims where match_id=$1", [
        id(20),
      ]);
      const staff = adminRepository(q),
        student = repository(q);
      await staff.review(
        id(2),
        {
          id: claim.id,
          status: "More information",
          message: "Describe the hidden marking.",
        },
        "ABCDEF123456",
        hash("ABCDEF123456"),
      );
      let own = await student.workspace({ id: id(1) } as any);
      assert.equal(
        own.state.claims.find((c) => c.id === claim.id).status,
        "More information",
      );
      assert.ok(
        own.state.notices.some(
          (n) =>
            n.matchId === id(20) &&
            n.message.includes("Describe the hidden marking."),
        ),
      );
      await q(
        "select submit_ownership_claim($1,$2,'New private ownership evidence')",
        [id(1), id(20)],
      );
      const privateStaff = await staff.workspace();
      assert.equal(
        privateStaff.claims.find((c) => c.id === claim.id).answers,
        "New private ownership evidence",
      );
      assert.equal(
        privateStaff.claims.find((c) => c.id === claim.id).status,
        "Pending",
      );
      own = await student.workspace({ id: id(1) } as any);
      assert.equal(
        own.state.claims.find((c) => c.id === claim.id).id,
        claim.id,
      );
      assert.ok(!JSON.stringify(own).includes("STAFF ONLY"));
      const foreign = await student.workspace({ id: id(3) } as any);
      assert.equal(foreign.state.claims.length, 0);
      assert.equal(foreign.messages.length, 0);
      assert.equal(foreign.state.notices.length, 0);
      await assert.rejects(
        q("select submit_ownership_claim($1,$2,'Foreign ownership evidence')", [
          id(3),
          id(20),
        ]),
        /unavailable/,
      );
      await staff.review(
        id(2),
        { id: claim.id, status: "Approved", zoneId: id(4) },
        "ABCDEF123456",
        hash("ABCDEF123456"),
      );
      const [pass] = await q("select id from pickups where claim_id=$1", [
        claim.id,
      ]);
      await q(
        "update pickups set expires_at=now()-interval '1 second' where id=$1",
        [pass.id],
      );
      await assert.rejects(
        staff.redeem(id(2), hash("ABCDEF123456")),
        /invalid or expired/,
      );
      await staff.reissue(
        id(2),
        pass.id,
        id(4),
        "123456ABCDEF",
        hash("123456ABCDEF"),
      );
      await assert.rejects(
        staff.redeem(id(2), hash("ABCDEF123456")),
        /invalid or expired/,
      );
      await staff.redeem(id(2), hash("123456ABCDEF"));
      const [other] = await q("select id from claims where match_id=$1", [
        id(21),
      ]);
      await assert.rejects(
        staff.review(
          id(2),
          { id: other.id, status: "Approved", zoneId: id(4) },
          "BBBBBBBBBBBB",
          hash("BBBBBBBBBBBB"),
        ),
        /cannot be changed/,
      );
      assert.equal(
        (
          await q("select count(*)::int n from reports where status='Returned'")
        )[0].n,
        2,
      );
      const zones = await listStudentDropoffs(q, "demo-campus");
      assert.equal(zones.length, 1);
      assert.ok(!JSON.stringify(zones).includes("PRIVATE"));
      const currentRecovery = await recoveryDefs();
      for (const source of sources) await db.exec(source);
      assert.deepEqual(await recoveryDefs(), currentRecovery);
      assert.deepEqual(await listStudentDropoffs(q, "demo-campus"), zones);
      assert.equal(
        (
          await q("select count(*)::int n from reports where status='Returned'")
        )[0].n,
        2,
      );
      assert.equal(
        (
          await q(
            "select used_at is not null as collected from pickups where id=$1",
            [pass.id],
          )
        )[0].collected,
        true,
      );
    } finally {
      await db.close();
    }
  },
);
