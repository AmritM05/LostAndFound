import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { adminRepository } from "../lib/server/adminRepository";
import { repository } from "../lib/server/repository";
import {
  validAdminCredentials,
  tokenHash,
  adminSessionCookie,
} from "../lib/server/adminSession";
import { calculateMatchScore } from "./matchingService";
import { GET as workspace } from "../app/api/admin/workspace/route";
import { POST as found } from "../app/api/admin/reports/route";
import { POST as actions } from "../app/api/admin/actions/route";
import { POST as zones } from "../app/api/admin/dropoffs/route";
const id = (n: number) =>
  `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
const profile = (n: number, role = "student") =>
  ({
    id: id(n),
    email: `demo${n}@example.com`,
    name: "Demo",
    role,
    verified: false,
  }) as any;
const item = (n: number, type = "lost") => ({
  id: id(n),
  type,
  name: "Black wallet",
  category: "Wallets & Cards",
  brand: "",
  model: "",
  color: "Black",
  description: "Leather wallet with hidden green stitching",
  features: "Leather wallet with hidden green stitching",
  date: new Date(Date.now() - 3600000).toISOString(),
  locationKnown: false,
  receivedAt: new Date().toISOString(),
  staffNotes: "Private locked drawer",
  dropoffZoneId: id(5),
});
test("admin credential comparison never authorizes email-only students or wrong passwords", () => {
  const previous = [
    process.env.ADMIN_DEMO_EMAIL,
    process.env.ADMIN_DEMO_PASSWORD,
  ];
  process.env.ADMIN_DEMO_EMAIL = "staff@example.com";
  process.env.ADMIN_DEMO_PASSWORD = "test-only-password";
  try {
    assert.equal(validAdminCredentials("staff@example.com", "wrong"), false);
    assert.equal(
      validAdminCredentials("other@example.com", "test-only-password"),
      false,
    );
    assert.equal(
      validAdminCredentials("STAFF@example.com", "test-only-password"),
      true,
    );
    assert.match(adminSessionCookie("opaque"), /HttpOnly; SameSite=Lax/);
    assert.ok(!adminSessionCookie("opaque").includes("password"));
  } finally {
    for (const [i, key] of [
      "ADMIN_DEMO_EMAIL",
      "ADMIN_DEMO_PASSWORD",
    ].entries()) {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    }
  }
});
test("all staff APIs reject missing admin sessions and foreign origins before service access", async () => {
  assert.equal(
    (await workspace(new Request("http://localhost:3000/api/admin/workspace")))
      .status,
    401,
  );
  for (const handler of [found, actions, zones]) {
    assert.equal(
      (
        await handler(
          new Request("http://localhost:3000/api/admin/action", {
            method: "POST",
            headers: {
              origin: "http://localhost:3000",
              cookie: "magpie_demo_session=" + "a".repeat(64),
            },
            body: "{}",
          }),
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await handler(
          new Request("http://localhost:3000/api/admin/action", {
            method: "POST",
            headers: { origin: "https://evil.test" },
            body: "{}",
          }),
        )
      ).status,
      403,
    );
  }
});
test("staff intake, automatic matching, private claim review, pickup and student isolation", async (t) => {
  const db = new PGlite();
  const q = async (s: string, v: any[] = []) =>
    (await db.query(s, v)).rows as any[];
  try {
    for (const f of [
      "001_student_backend.sql",
      "002_report_deletion.sql",
      "003_admin_portal.sql",
      "003_admin_portal.sql",
      "004_admin_recovery.sql",
      "004_admin_recovery.sql",
      "005_matching_engine.sql",
      "005_matching_engine.sql",
      "006_pickup_reissue.sql",
      "007_student_dropoff_visibility.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../db/migrations/" + f, import.meta.url),
          "utf8",
        ),
      );
    for (const n of [1, 2, 3])
      await q(
        "insert into users(id,email,display_name,role) values($1,$2,$3,$4)",
        [id(n), profile(n).email, "Demo", n === 3 ? "admin" : "student"],
      );
    await q(
      "insert into buildings(id,campus_id,name,latitude,longitude) values('thompson','osu','Thompson Library',40,-83)",
    );
    await q(
      "insert into dropoff_zones(id,building_id,name,instructions,active,latitude,longitude) values($1,'thompson','Library desk','Bring student ID',true,40,-83)",
      [id(5)],
    );
    const student = repository(q),
      admin = adminRepository(q),
      lost = item(10),
      foundItem = item(11, "found");
    await t.test(
      "only staff can intake, incomplete photos cannot be bound, and all private detail is stored",
      async () => {
        await assert.rejects(
          admin.saveFound(id(1), {
            item: foundItem,
            privateDetail: "Secret contents",
            imageIds: [],
          }),
          /Access denied/,
        );
        await q(
          "insert into report_images(id,owner_id,filename,mime_type,byte_size,blob_pathname,status) values($1,$2,'wallet.heic','image/heic',26214400,'test/private.heic','pending')",
          [id(6), id(3)],
        );
        await assert.rejects(
          admin.saveFound(id(3), {
            item: foundItem,
            privateDetail: "Secret contents",
            imageIds: [id(6)],
          }),
          /incomplete/,
        );
        await q(
          "update report_images set status='uploaded',upload_role='admin' where id=$1",
          [id(6)],
        );
        await admin.saveFound(id(3), {
          item: foundItem,
          privateDetail: "Secret contents",
          imageIds: [id(6)],
        });
        const saved = (await admin.workspace()).reports[0];
        assert.equal(saved.staffNotes, "Private locked drawer");
        assert.equal(saved.privateDetail, "Secret contents");
        assert.deepEqual(saved.imagePaths, [id(6)]);
        assert.equal(
          (await student.workspace(profile(1))).state.items.length,
          0,
        );
        assert.ok(!JSON.stringify(await student.search()).includes("Secret"));
      },
    );
    await t.test(
      "staff email student sessions cannot bind staff images to lost reports or student images to inventory",
      async () => {
        await q(
          "insert into report_images(id,owner_id,filename,mime_type,byte_size,blob_pathname,status,upload_role) values($1,$3,'qa.heic','image/heic',100,'test/role-admin','uploaded','admin'),($2,$3,'qa.jpg','image/jpeg',100,'test/role-student','uploaded','student')",
          [id(7), id(8), id(3)],
        );
        await assert.rejects(
          student.save(profile(3), item(14) as any, "", [id(7)]),
          /incomplete or unavailable/,
        );
        await assert.rejects(
          admin.saveFound(id(3), {
            item: item(15, "found"),
            privateDetail: "",
            imageIds: [id(8)],
          }),
          /incomplete or unavailable/,
        );
        assert.equal(
          (
            await q("select id from reports where id in ($1,$2)", [
              id(14),
              id(15),
            ])
          ).length,
          0,
        );
      },
    );
    await student.save(profile(1), lost as any, "Private lost evidence", []);
    const [m] = await q("select * from potential_matches");
    await t.test(
      "matching runs in either creation order and retains the existing score",
      async () => {
        assert.ok(m);
        assert.equal(
          m.score,
          calculateMatchScore(lost as any, foundItem as any).score,
        );
        await student.save(profile(2), item(12) as any, "Other evidence", []);
        assert.equal(
          (await q("select count(*)::int as n from potential_matches"))[0].n,
          2,
        );
        await admin.saveFound(id(3), {
          item: item(13, "found"),
          privateDetail: "Another private found",
          imageIds: [],
        });
        assert.equal(
          (await q("select count(*)::int as n from potential_matches"))[0].n,
          4,
        );
        assert.ok(
          (await student.workspace(profile(1))).state.notices.some(
            (n) => n.title === "Possible match",
          ),
        );
      },
    );
    let cid: string;
    await t.test(
      "foreign claim fails, owner claims block deletion and more-information can be resubmitted",
      async () => {
        await assert.rejects(
          q("select submit_ownership_claim($1,$2,$3)", [
            id(2),
            m.id,
            "This is my hidden detail",
          ]),
          /Match unavailable/,
        );
        cid = (
          await q("select submit_ownership_claim($1,$2,$3) as id", [
            id(1),
            m.id,
            "Green stitching inside a leather pocket",
          ])
        )[0].id;
        await assert.rejects(
          student.deleteReport(profile(1), lost.id),
          /active recovery/,
        );
        await admin.review(
          id(3),
          {
            id: cid,
            status: "More information",
            message: "Describe the inside pocket",
          },
          "",
          tokenHash(""),
        );
        await q("select submit_ownership_claim($1,$2,$3)", [
          id(1),
          m.id,
          "The green stitching is on the inside pocket",
        ]);
        assert.equal(
          (await q("select count(*)::int as n from claims"))[0].n,
          1,
        );
      },
    );
    await t.test(
      "approval issues an owner-only private pass and cannot assign the same item twice",
      async () => {
        await admin.review(
          id(3),
          {
            id: cid,
            status: "Approved",
            zoneId: id(5),
            message: "Bring your ID",
          },
          "AABBCCDDEEFF",
          tokenHash("AABBCCDDEEFF"),
        );
        const own = await student.workspace(profile(1));
        assert.equal(own.state.claims[0].code, "AABBCCDDEEFF");
        assert.equal(
          (await student.workspace(profile(2))).state.claims.length,
          0,
        );
        const [otherMatch] = await q(
          "select * from potential_matches where lost_report_id=$1 and found_report_id=$2",
          [id(12), id(11)],
        );
        await assert.rejects(
          q("select submit_ownership_claim($1,$2,$3)", [
            id(2),
            otherMatch.id,
            "Another student evidence",
          ]),
          /Match unavailable/,
        );
        await assert.rejects(
          admin.review(
            id(3),
            { id: cid, status: "Approved", zoneId: id(5) },
            "112233445566",
            tokenHash("112233445566"),
          ),
          /cannot be changed/,
        );
      },
    );
    await t.test(
      "wrong pickup codes fail, valid redemption is single-use and notifies the student",
      async () => {
        await assert.rejects(
          admin.redeem(id(3), tokenHash("wrong")),
          /invalid or expired/,
        );
        await admin.redeem(id(3), tokenHash("AABBCCDDEEFF"));
        await assert.rejects(
          admin.redeem(id(3), tokenHash("AABBCCDDEEFF")),
          /invalid or expired/,
        );
        const s = await student.workspace(profile(1));
        assert.equal(s.state.claims[0].status, "Returned");
        assert.equal(s.state.claims[0].code, null);
        assert.ok(s.state.notices.some((n) => n.title === "Item returned"));
        assert.equal(
          (await q("select status from reports where id=$1", [id(11)]))[0]
            .status,
          "Returned",
        );
        assert.ok(
          (await admin.workspace()).activity.some(
            (a: any) => a.action === "Confirmed item return",
          ),
        );
      },
    );
  } finally {
    await db.close();
  }
});
