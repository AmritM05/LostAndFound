import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldsFor } from "../lib/reportFields";
import { universityEmail, parseCampusConfig } from "../lib/campus";
test("category forms expose relevant fields and private ownership prompts", () => {
  assert.equal(fieldsFor("Electronics").model, true);
  assert.equal(fieldsFor("Electronics").size, false);
  assert.equal(fieldsFor("Clothing").size, true);
  assert.equal(fieldsFor("Clothing").model, false);
  assert.equal(fieldsFor("Wallet").brand, false);
  assert.equal(fieldsFor("Keys").itemLabel, "Key type");
  assert.notEqual(
    fieldsFor("Keys").itemPlaceholder,
    fieldsFor("Clothing").itemPlaceholder,
  );
  assert.match(
    fieldsFor("University ID").privatePlaceholder,
    /Do not include a full student ID/,
  );
});
test("campus email validation supports configured domains without hardcoded universities", () => {
  assert.ok(universityEmail("a@university.edu", []));
  assert.equal(universityEmail("a@example.com", []), true);
  assert.ok(universityEmail("a@campus.ac.uk", ["campus.ac.uk"]));
  assert.equal(
    universityEmail("a@university.edu.attacker.com", ["university.edu"]),
    false,
  );
  assert.equal(universityEmail("a@elsewhere.edu", ["university.edu"]), false);
});
test("campus parsing safely rejects invalid location records", () => {
  assert.ok(parseCampusConfig("{invalid").locations.length > 40);
  const c = parseCampusConfig(
    JSON.stringify({
      name: "Test university",
      locations: [
        { id: "valid", name: "Library", lat: 40, lng: -74, kind: "dropoff" },
        { name: "Bad location", lat: "invalid", lng: 0 },
      ],
    }),
  );
  assert.equal(c.name, "Test university");
  assert.equal(c.locations.length, 1);
  assert.equal(c.locations[0].id, "valid");
});
