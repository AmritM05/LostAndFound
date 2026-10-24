import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  staff = "33333333-3333-4333-8333-333333333333";
const lostId = "44444444-4444-4444-8444-444444444444",
  foundId = "55555555-5555-4555-8555-555555555555",
  thirdId = "66666666-6666-4666-8666-666666666666";
const setup = `create role anon nologin;create role authenticated nologin;create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,storage,public to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit int,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant select,insert,delete on storage.objects to authenticated;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;`;
async function asUser(db: PGlite, id: string, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
function item(id: string, type = "lost") {
  return {
    id,
    reporterId: type === "lost" ? alice : bob,
    type,
    name: "Wireless earbuds",
    category: "Electronics",
    brand: "Brand",
    model: "Pro",
    color: "Black",
    description: "Private sticker with a hidden engraving",
    features: "Private feature",
    location: "Secret apartment location",
    lat: 40,
    lng: -74,
    date: new Date(Date.now() - 3600000).toISOString(),
    dropoffZoneId: "77777777-7777-4777-8777-777777777777",
    receivedAt: new Date().toISOString(),
    custodyStatus: "Received",
    status: "Returned",
    image: "https://sensitive.invalid/photo.jpg",
  };
}
async function report(
  db: PGlite,
  id: string,
  type = "lost",
  paths: string[] = [],
) {
  await db.query("select public.submit_report($1,$2,$3::jsonb,$4,$5::text[])", [
    id,
    type,
    JSON.stringify(item(id, type)),
    "Serial ends in SECRET42",
    paths,
  ]);
}
test("database authorization, private correspondence, matching, and pickup lifecycle", async (t) => {
  const db = new PGlite();
  await db.exec(setup);
  const schema = (
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8")
  ).replace("create extension if not exists pgcrypto;", "");
  await db.exec(schema);
  // Reapplying must not delete records or create duplicate policies/triggers.
  await db.exec(schema);
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,$6,now())",
    [
      alice,
      "alice@university.edu",
      bob,
      "bob@university.edu",
      staff,
      "staff@university.edu",
    ],
  );
  await db.query("update public.profiles set role='admin' where id=$1", [
    staff,
  ]);
  await db.exec(
    "insert into public.pickup_locations(id,name,building,latitude,longitude,active) values('77777777-7777-4777-8777-777777777777','Campus intake desk','Campus',40,-74,true);",
  );
  const photo = `${alice}/${lostId}/photo.png`;
  await asUser(db, alice);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('item-images',$1)",
    [photo],
  );
  await report(db, lostId, "lost", [photo]);
  await db.query("select public.send_correspondence($1,$2)", [
    lostId,
    "Private student message: SECRET MESSAGE",
  ]);
  await asUser(db, staff);
  await report(db, foundId, "found");
  await asUser(db, bob);
  await t.test(
    "other students cannot query private report rows, photos, ownership details, or messages",
    async () => {
      assert.equal(
        (await db.query("select * from public.items where id=$1", [lostId]))
          .rows.length,
        0,
      );
      assert.equal(
        (
          await db.query("select * from public.item_images where item_id=$1", [
            lostId,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from storage.objects where name=$1", [photo]))
          .rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select * from public.private_item_details where item_id=$1",
            [lostId],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select * from public.correspondence where report_id=$1",
            [lostId],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        db.query("select public.send_correspondence($1,$2)", [
          lostId,
          "Attempted unauthorized message",
        ]),
        /access/,
      );
      await assert.rejects(
        db.query("update public.profiles set role='admin' where id=$1", [bob]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update public.items set payload='{}' where id=$1", [foundId]),
        /permission denied/,
      );
    },
  );
  await t.test(
    "anonymous public search exposes only allowed fields",
    async () => {
      await asUser(db, "", "anon");
      const r = await db.query<{ reports: any[] }>(
        "select public.search_public_reports() as reports",
      );
      const reports = r.rows[0].reports;
      assert.equal(reports.length, 1);
      assert.deepEqual(
        Object.keys(reports[0]).sort(),
        ["id", "type", "category", "location", "date", "status"].sort(),
      );
      assert.equal(reports[0].location, "Campus");
      assert.ok(!JSON.stringify(reports).includes("SECRET"));
      assert.ok(!JSON.stringify(reports).includes("sensitive"));
      await assert.rejects(
        db.query("select * from public.items"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from public.notifications"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from storage.objects"),
        /permission denied/,
      );
    },
  );
  await t.test(
    "owner and staff can view private photos, but signed URLs cannot be injected into payloads",
    async () => {
      await asUser(db, alice);
      assert.equal(
        (await db.query("select * from storage.objects where name=$1", [photo]))
          .rows.length,
        1,
      );
      const result = await db.query<{ payload: any }>(
        "select payload from public.items where id=$1",
        [lostId],
      );
      assert.equal(result.rows[0].payload.image, "");
      assert.notEqual(result.rows[0].payload.status, "Returned");
      await asUser(db, staff);
      assert.equal(
        (await db.query("select * from storage.objects where name=$1", [photo]))
          .rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.items")).rows.length,
        2,
      );
      assert.equal(
        (
          await db.query(
            "select * from public.correspondence where report_id=$1",
            [lostId],
          )
        ).rows.length,
        1,
      );
    },
  );
  let matchId: string, claimId: string, code: string;
  await t.test(
    "matching is automatic, private, and claimant-scoped",
    async () => {
      await asUser(db, alice);
      const r = await db.query<{ id: string }>("select id from public.matches");
      assert.equal(r.rows.length, 1);
      matchId = r.rows[0].id;
      await db.query("select public.submit_claim($1,$2)", [
        matchId,
        "The serial fragment ends in SECRET42",
      ]);
      claimId = (await db.query<{ id: string }>("select id from public.claims"))
        .rows[0].id;
      await assert.rejects(
        db.query("select public.submit_claim($1,$2)", [
          matchId,
          "Another duplicate ownership attempt",
        ]),
        /already submitted/,
      );
      await asUser(db, bob);
      assert.equal(
        (await db.query("select * from public.matches")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.claims")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("select public.submit_claim($1,$2)", [
          matchId,
          "Unauthorized ownership claim",
        ]),
        /not available/,
      );
      await assert.rejects(
        db.query("select public.review_claim($1,$2,$3,$4)", [
          claimId,
          "Approved",
          "Campus desk",
          "Unauthorized approval",
        ]),
        /Administrator/,
      );
    },
  );
  await t.test(
    "admin approval creates a server-generated pass and privately notifies the owner",
    async () => {
      await asUser(db, staff);
      await db.query("select public.review_claim($1,$2,$3,$4)", [
        claimId,
        "More information",
        "Campus desk",
        "Please confirm an additional hidden marking.",
      ]);
      await asUser(db, alice);
      assert.ok(
        (
          await db.query<{ body: string }>(
            "select body from public.correspondence",
          )
        ).rows.some((r) => r.body.includes("hidden marking")),
      );
      await db.query("select public.send_correspondence($1,$2)", [
        lostId,
        "There is also a scratch on the charging port.",
      ]);
      await asUser(db, staff);
      await db.query("select public.review_claim($1,$2,$3,$4)", [
        claimId,
        "Approved",
        "Campus information desk",
        "Your ownership details have been verified.",
      ]);
      const r = await db.query<{ payload: any }>(
        "select payload from public.claims where id=$1",
        [claimId],
      );
      code = r.rows[0].payload.code;
      assert.match(code, /^MAGPIE-[A-F0-9]{12}$/);
      assert.ok(r.rows[0].payload.token);
      assert.equal(
        (await db.query("select * from public.pickups")).rows.length,
        1,
      );
      await asUser(db, alice);
      assert.ok(
        (
          await db.query<{ payload: any }>(
            "select payload from public.notifications",
          )
        ).rows.some((r) => r.payload.title === "Your item is ready for pickup"),
      );
      await assert.rejects(
        db.query("select public.confirm_pickup($1)", [code]),
        /Administrator/,
      );
    },
  );
  await t.test(
    "pickup rejects invalid and reused codes, and updates both reports",
    async () => {
      await asUser(db, staff);
      await assert.rejects(
        db.query("select public.confirm_pickup($1)", ["MAGPIE-INVALID"]),
        /Invalid/,
      );
      await db.query("select public.confirm_pickup($1)", [code.toLowerCase()]);
      await assert.rejects(
        db.query("select public.confirm_pickup($1)", [code]),
        /already redeemed/,
      );
      const items = await db.query<{ payload: any }>(
        "select payload from public.items",
      );
      assert.ok(items.rows.every((r) => r.payload.status === "Returned"));
      await asUser(db, "", "anon");
      const r = await db.query<{ reports: any[] }>(
        "select public.search_public_reports() as reports",
      );
      assert.equal(r.rows[0].reports.length, 0);
    },
  );
  await t.test(
    "report validation rejects foreign photos, wrong categories, and future dates",
    async () => {
      await asUser(db, bob);
      await assert.rejects(
        report(db, thirdId, "lost", [photo]),
        /does not belong/,
      );
      await assert.rejects(
        db.query("select public.submit_report($1,$2,$3::jsonb,$4,$5::text[])", [
          thirdId,
          "lost",
          JSON.stringify({
            ...item(thirdId),
            category: "Secret custom identifying text",
          }),
          "",
          [],
        ]),
        /Invalid item category/,
      );
      await assert.rejects(
        db.query("select public.submit_report($1,$2,$3::jsonb,$4,$5::text[])", [
          thirdId,
          "lost",
          JSON.stringify({ ...item(thirdId), date: "2099-01-01T12:00:00Z" }),
          "",
          [],
        ]),
        /future/,
      );
    },
  );
  await t.test(
    "upgrade removes legacy broad policies while preserving records",
    async () => {
      await db.exec("reset role");
      await db.exec(
        "create policy item_read on public.items for select to authenticated using(true);create policy own_image_read on storage.objects for select to authenticated using(bucket_id='item-images');",
      );
      await db.exec(schema);
      await asUser(db, bob);
      assert.equal(
        (await db.query("select * from public.items where id=$1", [lostId]))
          .rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from storage.objects where name=$1", [photo]))
          .rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from public.items where id=$1", [foundId]))
          .rows.length,
        0,
      );
      await asUser(db, staff);
      assert.equal(
        (await db.query("select * from public.items")).rows.length,
        2,
      );
    },
  );
  await db.close();
});
