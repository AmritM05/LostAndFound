import test from "node:test";
import assert from "node:assert/strict";
import { staffAssessment } from "../components/admin/StaffMatchAssessment";

test("staff classification uses stored assessment and never invents historical reasoning", () => {
  assert.equal(staffAssessment({ classification: "very_strong_match", matchingFactors: ["Same brand"] }).label, "Strong potential match");
  assert.equal(staffAssessment({ classification: "possible_match" }).label, "Possible match");
  assert.equal(staffAssessment({ eligible: false, contradictions: ["Brand mismatch"] }).label, "No match");
  assert.deepEqual(staffAssessment({ matchingFactors: [null, {}, "Compatible model"] }).factors, ["Compatible model"]);
  for (const value of [null, {}, "invalid"]) assert.match(staffAssessment(value).label, /unavailable/);
});
