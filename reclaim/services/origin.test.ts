import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedOrigin } from "../lib/server/origin";
const req = (url: string, origin: string, extra = {}) =>
  new Request(url, { headers: { origin, ...extra } });
test("local ports and aliases work without permitting foreign origins", () => {
  assert.ok(
    allowedOrigin(
      req("http://0.0.0.0:3001/api/session", "http://localhost:3001"),
      { NODE_ENV: "development" } as any,
    ),
  );
  for (const origin of [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ])
    assert.ok(
      allowedOrigin(req("http://localhost:3000/api/session", origin), {
        NODE_ENV: "development",
      } as any),
    );
  for (const origin of [
    "https://evil.test",
    "null",
    "http://localhost.evil.test:3000",
  ])
    assert.equal(
      allowedOrigin(req("http://localhost:3000/api/session", origin), {
        NODE_ENV: "development",
      } as any),
      false,
    );
});
test("proxy mismatch is reproduced and trusted Vercel hosts resolve it", () => {
  const r = req(
    "http://localhost:3000/api/session",
    "https://preview.vercel.app",
    { "x-forwarded-host": "preview.vercel.app", "x-forwarded-proto": "https" },
  );
  assert.notEqual(r.headers.get("origin"), new URL(r.url).origin);
  assert.ok(allowedOrigin(r, { NODE_ENV: "production", VERCEL: "1" } as any));
  assert.equal(allowedOrigin(r, { NODE_ENV: "production" } as any), false);
  assert.ok(
    allowedOrigin(r, {
      NODE_ENV: "production",
      ALLOWED_ORIGINS: "https://preview.vercel.app",
    } as any),
  );
  assert.equal(
    allowedOrigin(req("https://app.example/api", "http://localhost:3001"), {
      NODE_ENV: "production",
    } as any),
    false,
  );
  assert.equal(
    allowedOrigin(new Request("https://app.example/api"), {
      NODE_ENV: "production",
    } as any),
    false,
  );
});
