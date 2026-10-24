import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { searchBuildings, campus } from "../lib/campus";
import { calculateMatchScore } from "./matchingService";
import { matchingFixture } from "./fixtures";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333";
const id = (n: number) =>
  `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
const setup = `create role anon nologin;create role authenticated nologin;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,storage,public to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit int,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;`;
async function asUser(db: PGlite, uid: string, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec(`set role ${role}`);
}
function payload(extra: Record<string, unknown> = {}) {
  return {
    name: "AirPods Pro",
    category: "Electronics",
    brand: "Apple",
    model: "Pro",
    color: "Black",
    description: "Private case with a concealed marking",
    date: new Date(Date.now() - 3600000).toISOString(),
    locationKnown: false,
    location: "Location unknown",
    lat: null,
    lng: null,
    ...extra,
  };
}
async function submit(
  db: PGlite,
  reportId: string,
  type: string,
  p: Record<string, unknown>,
  photos: string[] = [],
) {
  return db.query(
    "select public.submit_report($1,$2,$3::jsonb,$4,$5::text[])",
    [
      reportId,
      type,
      JSON.stringify(p),
      "Hidden serial fragment PRIVATE",
      photos,
    ],
  );
}
test("searchable building dataset supports partial names, aliases, and capitalization", () => {
  assert.equal(searchBuildings("Thom")[0].name, "Thompson Library");
  assert.equal(searchBuildings("dree")[0].name, "Dreese Laboratories");
  assert.ok(searchBuildings("UNION").some((b) => b.name === "Ohio Union"));
  assert.equal(
    searchBuildings("RPAC")[0].name,
    "Recreation and Physical Activity Center",
  );
  assert.ok(searchBuildings("Koffolt").length);
  assert.ok(searchBuildings("Curl Market").length);
  assert.ok(searchBuildings("Traditions at Scott").length);
  assert.ok(campus.locations.length >= 48);
  assert.deepEqual(searchBuildings("not-a-real-building"), []);
});
test("missing coordinates never become a fabricated zero-distance match", () => {
  const items = matchingFixture().items;
  const m = calculateMatchScore(
    { ...items[0], lat: null, lng: null },
    items[2],
  );
  assert.equal(m.distance, null);
  assert.equal("Location" in m.factors, false);
  assert.ok(Number.isFinite(m.score));
  assert.ok(m.score >= 60);
});
test("targeted lost-location, staff intake, search, authentication-profile and permissions scenarios", async (t) => {
  const db = new PGlite();
  await db.exec(setup);
  const schema = (
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8")
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(schema);
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,'newuser@example.com','{\"role\":\"admin\",\"full_name\":\"New user\"}',now()),($2,'other@example.com','{}',now()),($3,'staff@example.com','{}',now())",
    [a, b, admin],
  );
  await db.query("update public.profiles set role='admin' where id=$1", [
    admin,
  ]);
  let zone: string;
  await t.test(
    "new email accounts get student profiles regardless of signup metadata",
    async () => {
      const r = await db.query<{ role: string; full_name: string }>(
        "select role,full_name from public.profiles where id=$1",
        [a],
      );
      assert.equal(r.rows[0].role, "student");
      assert.equal(r.rows[0].full_name, "New user");
      await asUser(db, a);
      await assert.rejects(
        db.query("update public.profiles set role='admin' where id=$1", [a]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.save_dropoff_zone($1,$2::jsonb)", [
          null,
          JSON.stringify({ name: "Unauthorized desk", buildingId: "osu-0161" }),
        ]),
        /Administrator/,
      );
      await db.exec("reset role");
      await db.query("delete from public.profiles where id=$1", [b]);
      await asUser(db, b);
      await db.query("select public.ensure_profile()");
      assert.equal(
        (
          await db.query<{ role: string }>(
            "select role from public.profiles where id=$1",
            [b],
          )
        ).rows[0].role,
        "student",
      );
    },
  );
  await t.test(
    "lost AirPods with unknown location submit and persist null coordinates",
    async () => {
      await asUser(db, a);
      await submit(db, id(1), "lost", payload());
      const r = await db.query<any>(
        "select payload,latitude,longitude,location_known,building_id from public.items where id=$1",
        [id(1)],
      );
      assert.equal(r.rows[0].latitude, null);
      assert.equal(r.rows[0].longitude, null);
      assert.equal(r.rows[0].building_id, null);
      assert.equal(r.rows[0].location_known, false);
      assert.equal(r.rows[0].payload.location, "Location unknown");
      assert.equal(r.rows[0].payload.lat, null);
    },
  );
  await t.test(
    "building-only backpack report gets coordinates from configured Thompson Library",
    async () => {
      const building = searchBuildings("thom")[0];
      await submit(
        db,
        id(2),
        "lost",
        payload({
          name: "Backpack",
          category: "Backpack",
          locationKnown: true,
          buildingId: building.id,
          lat: null,
          lng: null,
        }),
      );
      const r = await db.query<any>(
        "select latitude,longitude,building_id,payload from public.items where id=$1",
        [id(2)],
      );
      assert.equal(r.rows[0].building_id, building.id);
      assert.equal(r.rows[0].latitude, building.lat);
      assert.equal(r.rows[0].longitude, building.lng);
      assert.equal(r.rows[0].payload.location, "Thompson Library");
    },
  );
  await t.test("map-only location is valid without a building", async () => {
    await submit(
      db,
      id(3),
      "lost",
      payload({
        name: "Notebook",
        category: "School Supplies",
        locationKnown: true,
        buildingId: null,
        lat: 40.0012,
        lng: -83.015,
      }),
    );
    const r = await db.query<any>(
      "select latitude,building_id,location_known from public.items where id=$1",
      [id(3)],
    );
    assert.equal(r.rows[0].latitude, 40.0012);
    assert.equal(r.rows[0].building_id, null);
    assert.equal(r.rows[0].location_known, true);
  });
  await t.test(
    "students cannot submit found reports through API role or payload manipulation",
    async () => {
      await assert.rejects(
        submit(
          db,
          id(4),
          "found",
          payload({ reportedByRole: "admin", reporterId: admin }),
        ),
        /Only authorized staff/,
      );
      await assert.rejects(
        db.query(
          "insert into public.items(id,reporter_id,report_type,payload) values($1,$2,'found','{}')",
          [id(4), a],
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.update_custody_status($1,$2)", [
          id(4),
          "Stored",
        ]),
        /Administrator/,
      );
    },
  );
  await t.test(
    "staff can configure approved intake zones and receive a found wallet with private photo",
    async () => {
      await asUser(db, admin);
      const r = await db.query<any>(
        "select public.save_dropoff_zone($1,$2::jsonb) as id",
        [
          null,
          JSON.stringify({
            name: "Ohio Union information desk",
            buildingId: "osu-0161",
            campusId: campus.id,
            description: "Bring items to the information desk.",
            active: true,
          }),
        ],
      );
      zone = r.rows[0].id;
      const path = `${admin}/${id(4)}/wallet.png`;
      await db.query(
        "insert into storage.objects(bucket_id,name) values('item-images',$1)",
        [path],
      );
      await submit(
        db,
        id(4),
        "found",
        payload({
          name: "Specific wallet name",
          category: "Wallet",
          brand: "PRIVATE BRAND",
          model: "PRIVATE MODEL",
          color: "PRIVATE COLOR",
          description: "PRIVATE CONTENTS AND MARKINGS",
          dropoffZoneId: zone,
          receivedAt: new Date().toISOString(),
          custodyStatus: "Received",
          staffNotes: "PRIVATE EXACT STORAGE ROOM",
        }),
        [path],
      );
      const item = (
        await db.query<any>("select * from public.items where id=$1", [id(4)])
      ).rows[0];
      assert.equal(item.reported_by_role, "admin");
      assert.equal(item.dropoff_zone_id, zone);
      assert.equal(item.custody_status, "Received");
      assert.ok(item.received_at);
      assert.equal(item.payload.imagePaths[0], path);
      await db.query("select public.update_custody_status($1,$2)", [
        id(4),
        "Stored",
      ]);
      assert.equal(
        (
          await db.query<any>(
            "select custody_status from public.items where id=$1",
            [id(4)],
          )
        ).rows[0].custody_status,
        "Stored",
      );
    },
  );
  await t.test(
    "Wallet search reveals only broad category, general building, date and generic status",
    async () => {
      await asUser(db, a);
      const r = await db.query<any>(
        "select public.search_public_reports() as reports",
      );
      const wallet = r.rows[0].reports.find(
        (r: any) => r.category === "Wallet",
      );
      assert.equal(wallet.location, "Ohio Union");
      assert.equal(wallet.status, "In Magpie custody");
      assert.deepEqual(
        Object.keys(wallet).sort(),
        ["id", "type", "category", "location", "date", "status"].sort(),
      );
      assert.ok(!JSON.stringify(wallet).includes("PRIVATE"));
      assert.equal(
        (await db.query("select * from public.items where id=$1", [id(4)])).rows
          .length,
        0,
      );
      assert.equal(
        (
          await db.query("select * from storage.objects where name=$1", [
            `${admin}/${id(4)}/wallet.png`,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query("select * from public.item_images where item_id=$1", [
            id(4),
          ])
        ).rows.length,
        0,
      );
    },
  );
  await t.test(
    "This might be mine requires an independently described compatible lost report",
    async () => {
      await assert.rejects(
        db.query("select public.connect_search_report($1,$2)", [id(4), id(1)]),
        /compatible/,
      );
      await assert.rejects(
        db.query("select public.connect_search_report($1,$2)", [id(4), id(99)]),
        /own active lost report/,
      );
      await submit(
        db,
        id(5),
        "lost",
        payload({
          name: "My missing wallet",
          category: "Wallet",
          brand: "Fossil",
          color: "Brown",
          description: "I described the wallet privately before claiming.",
        }),
      );
      const r = await db.query<any>(
        "select public.connect_search_report($1,$2) as match",
        [id(4), id(5)],
      );
      assert.equal(r.rows[0].match.lostId, id(5));
      assert.equal(r.rows[0].match.foundId, id(4));
      assert.equal(r.rows[0].match.distance, null);
      assert.ok(!JSON.stringify(r.rows[0].match).includes("PRIVATE"));
      await asUser(db, b);
      await assert.rejects(
        db.query("select public.connect_search_report($1,$2)", [id(4), id(5)]),
        /own active/,
      );
    },
  );
  await t.test(
    "own lost reports can be edited, other students and payload role changes cannot",
    async () => {
      await asUser(db, a);
      await db.query("select public.edit_lost_report($1,$2::jsonb,$3)", [
        id(1),
        JSON.stringify(
          payload({
            name: "My AirPods Pro",
            locationKnown: false,
            role: "admin",
            type: "found",
          }),
        ),
        "New private ownership detail",
      ]);
      const row = (
        await db.query<any>("select * from public.items where id=$1", [id(1)])
      ).rows[0];
      assert.equal(row.report_type, "lost");
      assert.equal(row.payload.name, "My AirPods Pro");
      assert.equal(row.latitude, null);
      assert.equal(row.reported_by_role, "student");
      await asUser(db, b);
      await assert.rejects(
        db.query("select public.edit_lost_report($1,$2::jsonb,$3)", [
          id(1),
          JSON.stringify(payload()),
          "Attempted edit",
        ]),
        /own lost/,
      );
    },
  );
  await t.test(
    "unknown location still participates in automatic matching without a location factor",
    async () => {
      await asUser(db, admin);
      await submit(
        db,
        id(6),
        "found",
        payload({
          name: "My AirPods Pro",
          dropoffZoneId: zone,
          receivedAt: new Date().toISOString(),
          locationKnown: true,
          lat: 40,
          lng: -83,
        }),
      );
      const r = await db.query<any>(
        "select payload from public.matches where lost_item_id=$1 and found_item_id=$2",
        [id(1), id(6)],
      );
      assert.equal(r.rows.length, 1);
      assert.equal(r.rows[0].payload.distance, null);
      assert.equal("Location proximity" in r.rows[0].payload.factors, false);
      assert.ok(r.rows[0].payload.score >= 60);
    },
  );
  await t.test("inactive drop-off zones reject new staff intake", async () => {
    await db.query("select public.save_dropoff_zone($1,$2::jsonb)", [
      zone,
      JSON.stringify({
        name: "Ohio Union information desk",
        buildingId: "osu-0161",
        active: false,
      }),
    ]);
    await assert.rejects(
      submit(
        db,
        id(7),
        "found",
        payload({ dropoffZoneId: zone, receivedAt: new Date().toISOString() }),
      ),
      /active approved/,
    );
  });
  await db.close();
});
