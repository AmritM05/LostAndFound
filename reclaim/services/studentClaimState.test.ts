import test from "node:test";
import assert from "node:assert/strict";
import type { Claim, Item } from "../lib/types";
import { studentClaimState, validateStudentAnswer } from "../components/portal/studentClaimState";
const claim = (status: Claim["status"], code?: string): Claim => ({
  id: "claim", matchId: "match", claimantId: "student", answers: "My private evidence", score: 0, status, code,
});
test("only an active More information claim offers answer resubmission", () => {
  for (const status of ["Pending", "More information", "Approved", "Rejected", "Returned"] as const) {
    assert.equal(studentClaimState(claim(status)).canRespond, status === "More information");
    for (const terminal of ["Returned", "Archived"] as Item["status"][]) {
      const view = studentClaimState(claim(status, "old-code"), { status: terminal });
      assert.equal(view.canRespond, false);
      assert.equal(view.canShowPass, false);
    }
  }
});
test("a pass is offered only for Approved with a server-projected current code", () => {
  assert.equal(studentClaimState(claim("Approved", "current-code")).canShowPass, true);
  for (const code of [undefined, "", "   "]) {
    const view = studentClaimState(claim("Approved", code));
    assert.equal(view.canShowPass, false);
    assert.match(view.message, /Contact campus staff/);
  }
  for (const status of ["Pending", "More information", "Rejected", "Returned"] as const)
    assert.equal(studentClaimState(claim(status, "stale-code")).canShowPass, false);
});
test("returned or archived reports override stale Approved and information states", () => {
  assert.equal(studentClaimState(claim("Approved", "stale-code"), { status: "Returned" }).title, "Item returned");
  assert.equal(studentClaimState(claim("More information"), { status: "Archived" }).title, "Report closed");
  assert.match(studentClaimState(claim("Pending")).message, /do not need to submit/);
});
test("ownership response limits validate trimmed evidence and exact boundaries", () => {
  for (const answer of ["", "          ", " 123456789 "]) assert.ok(validateStudentAnswer(answer));
  assert.equal(validateStudentAnswer(" 1234567890 "), "");
  assert.equal(validateStudentAnswer("a".repeat(1500)), "");
  assert.match(validateStudentAnswer("a".repeat(1501)), /1,500/);
});
