import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { repository } from "../lib/server/repository";
import { validateImage, imageType, MAX_IMAGE_BYTES } from "../lib/uploadConfig";
import { searchBuildings } from "../lib/campus";
import type { Item, Profile } from "../lib/types";
const id = (n: number) =>
  `11111111-1111-4111-8111-${String(n).padStart(12, "0")}`;
const user: Profile = {
    id: id(1),
    email: "student@example.com",
    name: "Student",
    role: "student",
    verified: false,
  },
  other: Profile = { ...user, id: id(2), email: "other@example.com" };
const item = (n: number, extra: Partial<Item> = {}): Item => ({
  id: id(n),
  reporterId: "untrusted-client",
  type: "lost",
  category: "Electronics",
  name: "Sample headphones",
  brand: "Private Brand",
  model: "Private Model",
  color: "Black",
  secondaryColor: "Red",
  description: "Private scratches and stickers",
  features: "Private markings",
  location: "untrusted label",
  locationKnown: false,
  buildingId: null,
  lat: 40,
  lng: -83,
  date: new Date(Date.now() - 3600000).toISOString(),
  status: "Matching",
  image: "",
  ...extra,
});
test("image policy accepts HEIC extensions, 20 MB files and rejects oversized/unsupported data", () => {
  for (const name of ["photo.heic", "photo.HEIF"]) {
    assert.equal(
      validateImage({ name, type: "", size: 20 * 1024 * 1024 }),
      null,
    );
    assert.ok(
      imageType({ name, type: "application/octet-stream" })?.startsWith(
        "image/hei",
      ),
    );
  }
  for (const type of [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ])
    assert.equal(
      validateImage({ name: "photo", type, size: MAX_IMAGE_BYTES }),
      null,
    );
  assert.match(
    validateImage({
      name: "photo.jpg",
      type: "image/jpeg",
      size: MAX_IMAGE_BYTES + 1,
    })!,
    /larger than the 25 MB upload limit/,
  );
  assert.match(
    validateImage({ name: "unsafe.svg", type: "image/svg+xml", size: 20 })!,
    /Choose a/,
  );
  assert.match(
    validateImage({ name: "empty.jpg", type: "image/jpeg", size: 0 })!,
    /empty/,
  );
});
test("Neon relational migration and server repository preserve privacy, ownership and location modes", async (t) => {
  const db = new PGlite();
  try {
    const schema = await readFile(
      new URL("../db/migrations/001_student_backend.sql", import.meta.url),
      "utf8",
    );
    await db.exec(schema);
    await db.exec(
      await readFile(
        new URL("../db/migrations/002_report_deletion.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(schema);
    await db.exec(
      await readFile(
        new URL("../db/migrations/002_report_deletion.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL("../db/migrations/003_admin_portal.sql", import.meta.url),
        "utf8",
      ),
    );
    const query = async (sql: string, values: any[] = []) =>
      (await db.query(sql, values)).rows as any[];
    const repo = repository(query);
    await query(
      "insert into users(id,email,display_name) values($1,$2,$3),($4,$5,$6)",
      [user.id, user.email, user.name, other.id, other.email, other.name],
    );
    assert.equal(
      (await query("select role from users where id=$1", [user.id]))[0].role,
      "student",
    );
    const building = searchBuildings("thom")[0];
    await query(
      "insert into buildings(id,campus_id,name,aliases,latitude,longitude) values($1,$2,$3,$4,$5,$6)",
      [
        building.id,
        "osu-columbus",
        building.name,
        building.aliases,
        building.lat,
        building.lng,
      ],
    );
    await t.test(
      "unknown locations discard guessed coordinates and survive repository reload",
      async () => {
        await repo.save(user, item(10), "Private serial fragment", []);
        const result = await repo.workspace(user);
        const saved = result.state.items[0];
        assert.equal(saved.reporterId, user.id);
        assert.equal(saved.secondaryColor, "Red");
        assert.equal(saved.lat, null);
        assert.equal(saved.lng, null);
        assert.equal(saved.buildingId, null);
        assert.equal(saved.locationKnown, false);
        assert.equal(
          result.state.privateDetails[id(10)],
          "Private serial fragment",
        );
        assert.equal((await repo.workspace(other)).state.items.length, 0);
        assert.equal((await repo.workspace(other)).messages.length, 0);
        assert.equal(result.state.notices.length, 1);
      },
    );
    await t.test(
      "building locations use database coordinates instead of caller coordinates",
      async () => {
        await repo.save(
          user,
          item(11, {
            locationKnown: true,
            buildingId: building.id,
            lat: 0,
            lng: 0,
          }),
          "",
          [],
        );
        const row = (
          await query("select * from reports where id=$1", [id(11)])
        )[0];
        assert.equal(row.latitude, building.lat);
        assert.equal(row.longitude, building.lng);
        assert.equal(row.location_label, "Thompson Library");
      },
    );
    await t.test(
      "map-only locations need no building; invalid coordinates are rejected",
      async () => {
        await repo.save(
          user,
          item(12, { locationKnown: true, lat: 40.003, lng: -83.01 }),
          "",
          [],
        );
        const row = (
          await query("select * from reports where id=$1", [id(12)])
        )[0];
        assert.equal(row.building_id, null);
        assert.equal(row.latitude, 40.003);
        await assert.rejects(
          repo.save(user, item(13, { locationKnown: true, lat: 91 }), "", []),
          /coordinates/,
        );
      },
    );
    await t.test(
      "only the owner can edit; report creation is idempotent and students cannot submit found",
      async () => {
        await assert.rejects(
          repo.save(other, item(10), "", [], true),
          /not found/,
        );
        await assert.rejects(
          repo.save(user, item(14, { type: "found" }), "", []),
          /only create lost/,
        );
        await repo.save(
          user,
          item(10, { name: "Changed name" }),
          "Changed private detail",
          [],
          true,
        );
        await repo.save(user, item(10), "Ignored duplicate", []);
        const saved = await repo.workspace(user);
        assert.equal(
          saved.state.items.find((r) => r.id === id(10))?.name,
          "Changed name",
        );
        assert.equal(
          saved.state.privateDetails[id(10)],
          "Changed private detail",
        );
        assert.equal(saved.state.items.length, 3);
      },
    );
    await t.test(
      "image references require completed uploads by the owner and remain associated on reload",
      async () => {
        await query(
          "insert into report_images(id,owner_id,filename,mime_type,byte_size,blob_pathname,status) values($1,$2,'photo.heic','image/heic',20971520,'private/original.heic','pending')",
          [id(20), user.id],
        );
        await assert.rejects(
          repo.save(user, item(15), "", [id(20)]),
          /incomplete/,
        );
        await query(
          "update report_images set status='uploaded',blob_url='https://store.private.blob.vercel-storage.com/private/original.heic' where id=$1",
          [id(20)],
        );
        await assert.rejects(
          repo.save(other, item(15), "", [id(20)]),
          /unavailable/,
        );
        await repo.save(user, item(15), "", [id(20)]);
        const saved = (await repo.workspace(user)).state.items.find(
          (r) => r.id === id(15),
        )!;
        assert.deepEqual(saved.imagePaths, [id(20)]);
        assert.equal(
          JSON.stringify(saved).includes("blob.vercel-storage"),
          false,
        );
        await assert.rejects(
          repo.save(user, item(16), "", [id(20)]),
          /unavailable/,
        );
      },
    );
    await t.test(
      "generic search exposes only the six safe summary fields",
      async () => {
        await query(
          "insert into dropoff_zones(id,building_id,name,active) values($1,$2,'Private storage room',true)",
          [id(30), building.id],
        );
        await query(
          "insert into reports(id,reporter_id,report_type,category,item_name,brand,model,primary_color,description,lost_date,lost_time,occurred_at,dropoff_zone_id,staff_notes) values($1,$2,'found','Electronics','SECRET NAME','SECRET BRAND','SECRET MODEL','SECRET COLOR','SECRET DESCRIPTION',current_date,current_time,now(),$3,'SECRET STAFF ROOM')",
          [id(31), other.id, id(30)],
        );
        const rows = await repo.search();
        assert.equal(rows.length, 1);
        assert.deepEqual(
          Object.keys(rows[0]).sort(),
          ["id", "type", "category", "location", "date", "status"].sort(),
        );
        assert.equal(rows[0].location, "Thompson Library");
        assert.ok(!JSON.stringify(rows).includes("SECRET"));
        assert.ok(!JSON.stringify(rows).includes("photo"));
        assert.equal(
          (await repo.workspace(user)).state.items.some((r) => r.id === id(31)),
          false,
        );
      },
    );
  } finally {
    await db.close();
  }
});
