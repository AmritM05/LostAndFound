import test from "node:test";
import assert from "node:assert/strict";
import { publicDropoffResult, configuredDropoffs } from "../components/portal/studentDropoffs";
import { campus } from "../lib/campus";

test("student drop-off boundary keeps only public fields and optional building labels", () => {
  const result = publicDropoffResult({ source: "approved-api", zones: [{ id: "desk", name: "Public desk", building: "Sample Library", instructions: "Ask staff at the public desk", lat: 40, lng: -83, staffNotes: "PRIVATE", storageLocation: "PRIVATE", imageUrl: "PRIVATE", reporterEmail: "PRIVATE" }] });
  assert.deepEqual(result.zones[0], { id: "desk", name: "Public desk", building: "Sample Library", instructions: "Ask staff at the public desk", lat: 40, lng: -83 });
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
});
test("invalid, missing or partial coordinates never produce fabricated Maps links", () => {
  for (const [lat, lng] of [[null, null], [40, null], [91, -83], [40, 181], [NaN, -83], [Infinity, -83], ["40", "-83"]]) {
    const result = publicDropoffResult({ source: "approved-api", zones: [{ id: "desk", name: "Desk", instructions: "", lat, lng }] });
    assert.equal(result.zones[0].lat, null);
    assert.equal(result.zones[0].lng, null);
  }
});
test("unrecognized guidance fails safely; an explicit empty list stays empty", () => {
  for (const value of [null, {}, { source: "admin-workspace", zones: [] }, { source: "approved-api", zones: [{}] }]) assert.throws(() => publicDropoffResult(value));
  assert.deepEqual(publicDropoffResult({ source: "approved-api", zones: [] }), { source: "approved-api", zones: [] });
});
test("configured guidance remains labelled configuration and excludes buildings/inactive desks", async () => {
  const config = { ...campus, locations: [
    { id: "building", name: "Building", kind: "building", lat: 40, lng: -83 },
    { id: "inactive", name: "Closed", kind: "dropoff", active: false, lat: 40, lng: -83 },
  ] } as any;
  assert.deepEqual(await configuredDropoffs(config), { source: "campus-config", zones: [] });
});

test("explicit inactive, unapproved or student-hidden flags never render as intake", () => {
  const zone = { id: "desk", name: "Public desk", instructions: "", lat: 40, lng: -83 };
  for (const flag of ["active", "approved", "studentVisible"])
    assert.deepEqual(publicDropoffResult({ source: "approved-api", zones: [{ ...zone, [flag]: false }] }).zones, []);
});

test("published API adapter maps public instructions and rejects inactive/other-campus desks", async () => {
  const { approvedDropoffResult } = await import("../components/portal/studentDropoffs");
  const zone = { id: "desk", campusId: campus.id, name: "Published desk", building: "Library", description: "Public entrance", lat: 40, lng: -83, active: true, instructions: "PRIVATE", staffNotes: "PRIVATE" };
  const result = approvedDropoffResult([zone, { ...zone, active: false }, { ...zone, campusId: "other-campus" }]);
  assert.equal(result.zones.length, 1);
  assert.equal(result.zones[0].instructions, "Public entrance");
  assert.ok(!JSON.stringify(result).includes("PRIVATE"));
  assert.deepEqual(approvedDropoffResult([]), { source: "approved-api", zones: [] });
  assert.throws(() => approvedDropoffResult({ zones: [zone] }));
});
