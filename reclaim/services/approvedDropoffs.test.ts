import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  studentDropoffProjection,
  listStudentDropoffs,
  studentDropoffEndpoint,
} from "../lib/server/studentDropoffs";
import { ApiError } from "../lib/server/http";
import { ServiceFailure } from "../lib/server/diagnostics";
import { GET } from "../app/api/dropoffs/route";
import { POST as saveZone } from "../app/api/admin/dropoffs/route";
const id = (n: number) =>
  `77777777-7777-4777-8777-${String(n).padStart(12, "0")}`;
const row = () => ({
  id: id(1),
  name: "Public desk",
  active: true,
  student_visible: true,
  public_instructions: "Hand the item to reception.",
  building_id: "public-building",
  building: "Public building",
  public_lat: 40,
  public_lng: -83,
});
const keys = [
  "id",
  "campusId",
  "name",
  "buildingId",
  "building",
  "description",
  "lat",
  "lng",
  "active",
].sort();

test("approved zone projection allowlists public fields and never copies staff/storage data", () => {
  const projected = studentDropoffProjection(
    {
      ...row(),
      instructions: "PRIVATE STAFF INSTRUCTIONS",
      staff_notes: "SECRET",
      storage_area: "LOCKED ROOM",
      latitude: 1,
      longitude: 2,
      email: "PRIVATE EMAIL",
      custody_status: "Stored",
      image_url: "PRIVATE PHOTO",
    },
    "sample-campus",
  );
  assert.deepEqual(Object.keys(projected!).sort(), keys);
  assert.equal(projected.description, "Hand the item to reception.");
  assert.equal(projected.lat, 40);
  assert.equal(projected.lng, -83);
  assert.ok(!JSON.stringify(projected).includes("PRIVATE"));
  assert.equal(projected.campusId, "sample-campus");
});

test("inactive, unapproved and invalid records fail closed; invalid coordinates become a null pair", () => {
  for (const changes of [
    { active: false },
    { student_visible: false },
    { student_visible: "true" },
    { id: "invalid" },
    { name: " " },
    { name: 42 },
    { public_instructions: "" },
    { public_instructions: "x".repeat(2001) },
    { building_id: 42 },
    { building_id: "" },
    { building: null },
  ])
    assert.equal(
      studentDropoffProjection({ ...row(), ...changes }, "sample-campus"),
      null,
    );
  for (const value of [null, undefined, [], 42])
    assert.equal(studentDropoffProjection(value as any, "sample-campus"), null);
  for (const changes of [
    { public_lat: null },
    { public_lng: null },
    { public_lat: Infinity },
    { public_lat: NaN },
    { public_lat: 91 },
    { public_lng: -181 },
    { public_lat: "40" },
  ]) {
    const projected = studentDropoffProjection(
      { ...row(), ...changes },
      "sample-campus",
    );
    assert.equal(projected.lat, null);
    assert.equal(projected.lng, null);
  }
  const unlocated = studentDropoffProjection(
    {
      ...row(),
      building_id: null,
      building: null,
      public_lat: 1,
      public_lng: 2,
    },
    "sample-campus",
  );
  assert.equal(unlocated.buildingId, null);
  assert.equal(unlocated.building, "");
  assert.equal(unlocated.lat, null);
  assert.equal(unlocated.lng, null);
});

test("actual zone query filters publication, active buildings and campus; no legacy auto-publication on replay", async () => {
  const db = new PGlite();
  const q = async (sql: string, values: any[] = []) =>
    (await db.query(sql, values)).rows as any[];
  try {
    const directory = new URL("../db/migrations/", import.meta.url);
    for (const file of (await readdir(directory))
      .filter((f) => f.endsWith(".sql") && !f.startsWith("007_"))
      .sort())
      await db.exec(await readFile(new URL(file, directory), "utf8"));
    await q(
      "insert into buildings(id,campus_id,name,latitude,longitude,active) values('public-building','sample-campus','Public building',40,-83,true),('foreign','other-campus','Other campus',20,30,true),('closed','sample-campus','Closed building',10,20,false)",
    );
    await q(
      "insert into dropoff_zones(id,name,instructions,active,building_id,latitude,longitude) values($1,'Legacy storage desk','PRIVATE LEGACY INSTRUCTIONS',true,'public-building',1,2)",
      [id(1)],
    );
    const migration = await readFile(
      new URL("007_student_dropoff_visibility.sql", directory),
      "utf8",
    );
    await db.exec(migration);
    assert.deepEqual(await listStudentDropoffs(q, "sample-campus"), []);
    for (const [n, active, visible, building] of [
      [2, true, true, "public-building"],
      [3, false, true, "public-building"],
      [4, true, false, "public-building"],
      [5, true, true, "foreign"],
      [6, true, true, "closed"],
      [7, true, true, null],
    ] as const)
      await q(
        "insert into dropoff_zones(id,name,instructions,public_instructions,active,student_visible,building_id,latitude,longitude) values($1,$2,'PRIVATE STAFF STORAGE','Use the reception desk',$3,$4,$5,1,2)",
        [id(n), "Desk " + n, active, visible, building],
      );
    let zones = await listStudentDropoffs(q, "sample-campus");
    assert.deepEqual(
      zones.map((z) => z.id),
      [id(2), id(7)],
    );
    assert.equal(zones[0].lat, 40);
    assert.equal(zones[0].lng, -83);
    assert.equal(zones[1].lat, null);
    assert.equal(zones[1].lng, null);
    assert.ok(!JSON.stringify(zones).includes("PRIVATE"));
    await db.exec(migration); // Reapplying must preserve explicit publication, not reset or reveal legacy rows.
    assert.deepEqual(await listStudentDropoffs(q, "sample-campus"), zones);
    await q("update dropoff_zones set student_visible=false where id=$1", [
      id(2),
    ]);
    zones = await listStudentDropoffs(q, "sample-campus");
    assert.deepEqual(
      zones.map((z) => z.id),
      [id(7)],
    );
    await q("update dropoff_zones set active=false where id=$1", [id(7)]);
    assert.deepEqual(await listStudentDropoffs(q, "sample-campus"), []);
  } finally {
    await db.close();
  }
});

test("read endpoint requires student authorization before query and returns private no-store results", async () => {
  let calls = 0;
  const request = new Request("http://localhost:3000/api/dropoffs/");
  const blocked = studentDropoffEndpoint({
    campusId: "sample-campus",
    requireStudent: async () => {
      throw new ApiError("Sign in to continue.", 401);
    },
    query: async () => {
      calls++;
      return [row()];
    },
  });
  assert.equal((await blocked(request)).status, 401);
  assert.equal(calls, 0);
  for (const records of [[], [row()]]) {
    const handler = studentDropoffEndpoint({
      campusId: "sample-campus",
      requireStudent: async () => ({ id: "sample-student" }),
      query: async () => records,
    });
    const response = await handler(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(response.headers.get("Vary"), "Cookie");
    const body = await response.json();
    assert.equal(body.length, records.length);
    if (body.length) assert.deepEqual(Object.keys(body[0]).sort(), keys);
  }
});

test("database and authorization-service failures use safe errors rather than an empty success", async () => {
  const request = new Request("http://localhost:3000/api/dropoffs/");
  const failing = studentDropoffEndpoint({
    campusId: "sample-campus",
    requireStudent: async () => ({}),
    query: async () => {
      throw new Error("PRIVATE CONNECTION STRING");
    },
  });
  let response = await failing(request);
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(await response.json()).includes("PRIVATE"));
  const authFail = studentDropoffEndpoint({
    campusId: "sample-campus",
    requireStudent: async () => {
      throw new ServiceFailure(
        "database.connect",
        "configuration",
        "Database setup is incomplete.",
      );
    },
    query: async () => {
      throw new Error("should not query");
    },
  });
  response = await authFail(request);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Database setup is incomplete.",
  });
});

test("real read/mutation routes reject missing or wrong-workspace cookies before service access", async () => {
  for (const cookie of ["", "magpie_admin_session=" + "a".repeat(64)]) {
    const response = await GET(
      new Request("http://localhost:3000/api/dropoffs/", {
        headers: { cookie },
      }),
    );
    assert.equal(response.status, 401);
  }
  const response = await saveZone(
    new Request("http://localhost:3000/api/admin/dropoffs/", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: "magpie_demo_session=" + "a".repeat(64),
      },
      body: JSON.stringify({
        studentVisible: true,
        publicInstructions: "Public",
      }),
    }),
  );
  assert.equal(response.status, 401);
});
