import { test } from "node:test";
import assert from "node:assert/strict";
import { searchBuildings, campus, universityEmail } from "../lib/campus";
test("empty building search returns every active building, including the end of the list", () => {
  const active = campus.locations.filter((b) => b.active !== false);
  assert.equal(searchBuildings("").length, active.length);
  for (const building of active)
    assert.ok(searchBuildings("").some((b) => b.id === building.id));
  assert.equal(
    searchBuildings("", [{ ...active[0], active: false }]).length,
    0,
  );
});
test("blank domain allowlist permits ordinary valid email addresses", () => {
  if (!campus.allowedDomains.length)
    assert.equal(universityEmail("participant@example.com"), true);
  assert.equal(universityEmail("invalid-email"), false);
});
