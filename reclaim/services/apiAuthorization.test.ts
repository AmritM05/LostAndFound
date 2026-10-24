import { DELETE as deleteReport } from "../app/api/reports/[id]/route";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET as workspace } from "../app/api/workspace/route";
import { GET as photo } from "../app/api/images/[id]/route";
import { POST as report } from "../app/api/reports/route";
import { POST as reserve } from "../app/api/images/reserve/route";
import { GET as session } from "../app/api/session/route";
test("private endpoints reject missing sessions before database or Blob access", async () => {
  const root = "http://localhost:3000";
  assert.equal(
    (await workspace(new Request(root + "/api/workspace/"))).status,
    401,
  );
  assert.equal(
    (
      await photo(new Request(root + "/api/images/unknown/"), {
        params: Promise.resolve({ id: "unknown" }),
      })
    ).status,
    401,
  );
  for (const handler of [report, reserve])
    assert.equal(
      (
        await handler(
          new Request(root + "/api/reports/", {
            method: "POST",
            headers: { origin: root, "content-type": "application/json" },
            body: "{}",
          }),
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await report(
        new Request(root + "/api/reports/", {
          method: "POST",
          headers: { origin: "https://untrusted.example" },
          body: "{}",
        }),
      )
    ).status,
    403,
  );
  const response = await session(new Request(root + "/api/session/"));
  assert.deepEqual(await response.json(), { user: null });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
});

test("report deletion requires a session and rejects cross-origin requests", async () => {
  const root = "http://localhost:3000";
  const context = {
    params: Promise.resolve({ id: "22222222-2222-4222-8222-000000000010" }),
  };
  assert.equal(
    (
      await deleteReport(
        new Request(root + "/api/reports/test/", {
          method: "DELETE",
          headers: { origin: root },
        }),
        context,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await deleteReport(
        new Request(root + "/api/reports/test/", {
          method: "DELETE",
          headers: { origin: "https://other.example" },
        }),
        context,
      )
    ).status,
    403,
  );
});
