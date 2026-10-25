import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { repository } from "../lib/server/repository";
import { processBlobCleanup } from "../lib/server/blobCleanup";
import {
  imageType,
  isSupportedImage,
  validateImage,
  MAX_IMAGE_UPLOAD_BYTES,
} from "../lib/uploadConfig";
const id = (n: number) =>
  `22222222-2222-4222-8222-${String(n).padStart(12, "0")}`;
test("one upload policy supports HEIC/HEIF MIME variants and 25 MB per image", () => {
  for (const name of ["photo.heic", "photo.HEIF"])
    for (const type of [
      "",
      "application/octet-stream",
      "unexpected/device-type",
      "image/heic-sequence",
      "image/heif-sequence",
    ])
      assert.equal(validateImage({ name, type, size: 20 * 1024 * 1024 }), null);
  for (const type of ["image/heic-sequence", "image/heif-sequence"]) {
    assert.ok(isSupportedImage({ name: "photo", type }));
    assert.ok(
      ["image/heic", "image/heif"].includes(
        imageType({ name: "photo", type })!,
      ),
    );
  }
  for (const size of [10, 20, 25])
    for (const name of [
      "sample.jpeg",
      "sample.png",
      "sample.webp",
      "sample.heic",
      "sample.heif",
    ])
      assert.equal(
        validateImage({
          name,
          type: "application/octet-stream",
          size: size * 1024 * 1024,
        }),
        null,
      );
  assert.equal(MAX_IMAGE_UPLOAD_BYTES, 25 * 1024 * 1024);
  assert.equal(
    validateImage({ name: "photo.heic", type: "", size: 30 * 1024 * 1024 }),
    "This image is larger than the 25 MB upload limit.",
  );
  assert.equal(
    isSupportedImage({ name: "unsafe.svg", type: "image/svg+xml" }),
    false,
  );
});
test("owned deletion is transactional, protects recovery, and queues only related private blobs", async (t) => {
  const db = new PGlite();
  try {
    for (const file of [
      "001_student_backend.sql",
      "002_report_deletion.sql",
      "003_admin_portal.sql",
      "002_report_deletion.sql",
      "003_admin_portal.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../db/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    const run = async (sql: string, values: any[] = []) =>
      (await db.query(sql, values)).rows as any[];
    await run(
      "insert into users(id,email,display_name) values($1,'one@example.com','One'),($2,'two@example.com','Two')",
      [id(1), id(2)],
    );
    const insert = async (n: number, owner = 1, type = "lost") =>
      run(
        "insert into reports(id,reporter_id,report_type,category,item_name,lost_date,lost_time,occurred_at) values($1,$2,$3,'Electronics','Sample',current_date,current_time,now())",
        [id(n), id(owner), type],
      );
    // This suite supplies explicit match fixtures; automatic generation has its own lifecycle suite.
    await run("alter table reports disable trigger reports_match");
    await insert(10);
    await insert(11, 2);
    await insert(12, 2, "found");
    await insert(13, 2, "found");
    const repo = repository(run),
      user = {
        id: id(1),
        name: "One",
        email: "one@example.com",
        role: "student" as const,
        verified: false,
      };
    await t.test(
      "foreign reports and found reports cannot be deleted by an arbitrary ID",
      async () => {
        assert.equal(await repo.deleteReport(user, id(11)), false);
        assert.equal(await repo.deleteReport(user, id(12)), false);
        assert.equal(await repo.deleteReport(user, id(999)), false);
        assert.equal(
          (await run("select count(*)::int as n from reports"))[0].n,
          4,
        );
        assert.equal(
          (await run("select count(*)::int as n from blob_cleanup_jobs"))[0].n,
          0,
        );
      },
    );
    await run(
      "insert into potential_matches(id,lost_report_id,found_report_id,score) values($1,$2,$3,90),($4,$5,$6,80)",
      [id(20), id(10), id(12), id(21), id(11), id(13)],
    );
    await run(
      "insert into claims(id,match_id,claimant_id,answers,status) values($1,$2,$3,'Sample','Pending')",
      [id(30), id(20), id(1)],
    );
    await t.test(
      "pending, more-information and approved claims block deletion without changing data",
      async () => {
        for (const status of ["Pending", "More information", "Approved"]) {
          await run("update claims set status=$1 where id=$2", [
            status,
            id(30),
          ]);
          assert.equal(
            (await repo.workspace(user)).state.items[0].deletionBlocked,
            true,
          );
          await assert.rejects(
            repo.deleteReport(user, id(10)),
            /cannot be deleted while an active recovery/,
          );
          assert.equal(
            (await run("select count(*)::int as n from blob_cleanup_jobs"))[0]
              .n,
            0,
          );
        }
      },
    );
    await run("update claims set status='Rejected' where id=$1", [id(30)]);
    await run(
      "insert into pickups(id,claim_id,expires_at) values($1,$2,now()+interval '1 day')",
      [id(40), id(30)],
    );
    await t.test(
      "an unused pickup also blocks deletion even if claim state is inconsistent",
      async () => {
        await assert.rejects(
          repo.deleteReport(user, id(10)),
          /active recovery/,
        );
        await run("update pickups set used_at=now() where id=$1", [id(40)]);
      },
    );
    await run(
      "insert into private_report_details(report_id,owner_description) values($1,'Private target'),($2,'Keep private')",
      [id(10), id(11)],
    );
    await run(
      "insert into report_notes(report_id,sender_id,body) values($1,$2,'Target note'),($3,$4,'Keep note')",
      [id(10), id(1), id(11), id(2)],
    );
    await run(
      "insert into report_images(id,owner_id,report_id,filename,mime_type,byte_size,blob_pathname,preview_pathname,status) values($1,$2,$3,'photo.heic','image/heic',20971520,'target/original.heic','target/preview.webp','uploaded'),($4,$5,$6,'keep.jpg','image/jpeg',100,'keep/original.jpg',null,'uploaded')",
      [id(50), id(1), id(10), id(51), id(2), id(11)],
    );
    await run(
      "insert into updates(id,user_id,report_id,match_id,title,message) values($1,$2,$3,$4,'Target','Target'),($5,$6,$7,$4,'Keep found report notice','Keep'),($8,$6,$9,$10,'Unrelated','Keep')",
      [
        id(60),
        id(1),
        id(10),
        id(20),
        id(61),
        id(2),
        id(12),
        id(62),
        id(11),
        id(21),
      ],
    );
    await t.test(
      "deletes the owned report and dependencies but preserves unrelated reports, images and notices",
      async () => {
        assert.equal(await repo.deleteReport(user, id(10)), true);
        for (const [table, column, value] of [
          ["reports", "id", id(10)],
          ["private_report_details", "report_id", id(10)],
          ["report_images", "report_id", id(10)],
          ["report_notes", "report_id", id(10)],
          ["potential_matches", "id", id(20)],
          ["claims", "id", id(30)],
          ["pickups", "id", id(40)],
          ["updates", "id", id(60)],
        ])
          assert.equal(
            (await run(`select * from ${table} where ${column}=$1`, [value]))
              .length,
            0,
          );
        assert.equal((await repo.workspace(user)).state.items.length, 0);
        assert.equal((await run("select * from reports")).length, 3);
        assert.equal(
          (await run("select * from report_images"))[0].blob_pathname,
          "keep/original.jpg",
        );
        assert.equal(
          (await run("select * from updates where id=$1", [id(61)]))[0]
            .match_id,
          null,
        );
        assert.equal(
          (await run("select * from updates where id=$1", [id(62)]))[0]
            .match_id,
          id(21),
        );
        assert.deepEqual(
          (
            await run(
              "select blob_pathname from blob_cleanup_jobs order by blob_pathname",
            )
          ).map((j) => j.blob_pathname),
          ["target/original.heic", "target/preview.webp"],
        );
      },
    );
    await t.test(
      "Blob failures retain retry jobs without resurrecting the report; a retry removes only queued paths",
      async () => {
        const jobs = await run(
          "select * from blob_cleanup_jobs where completed_at is null",
        );
        const original = console.error;
        console.error = () => {};
        try {
          assert.equal(
            (
              await processBlobCleanup(jobs, run, async () => {
                throw new Error("Temporary storage failure");
              })
            ).pending,
            2,
          );
        } finally {
          console.error = original;
        }
        assert.equal(
          (await run("select * from reports where id=$1", [id(10)])).length,
          0,
        );
        assert.ok(
          (await run("select * from blob_cleanup_jobs")).every(
            (j) => j.attempts === 1 && j.completed_at === null,
          ),
        );
        const removed: string[] = [];
        assert.equal(
          (
            await processBlobCleanup(jobs, run, async (path) => {
              removed.push(path);
            })
          ).pending,
          0,
        );
        assert.deepEqual(removed.sort(), [
          "target/original.heic",
          "target/preview.webp",
        ]);
        assert.ok(
          (await run("select * from blob_cleanup_jobs")).every(
            (j) => j.completed_at !== null && j.attempts === 2,
          ),
        );
      },
    );
  } finally {
    await db.close();
  }
});
