import { neon } from "@neondatabase/serverless";
import { list } from "@vercel/blob";
let failed = false;
try {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.username ||
    !url.password ||
    !url.hostname.endsWith(".neon.tech") ||
    url.pathname.length < 2
  )
    throw new Error("configuration");
  const sql = neon(process.env.DATABASE_URL!);
  await sql.query("select 1");
  const [schema] = await sql.query(
    "select to_regclass('public.admin_sessions') is not null as admin_ready, to_regprocedure('public.delete_own_lost_report(uuid,uuid)') is not null as deletion_ready",
  );
  console.log("Neon: connected", schema);
  if (!schema.admin_ready || !schema.deletion_ready) failed = true;
} catch (e) {
  failed = true;
  console.error("Neon: failed", {
    reason:
      (e as Error).message === "configuration"
        ? "Invalid or incomplete Neon PostgreSQL connection string"
        : "Connection failed",
    code: /^[A-Z0-9_]+$/.test((e as any).code || "")
      ? (e as any).code
      : undefined,
  });
}
try {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.startsWith("vercel_blob_rw_"))
    throw new Error("configuration");
  await list({ limit: 1 });
  console.log(
    "Blob: token accepted (read check; run an authenticated upload to verify writes and private-store settings).",
  );
} catch (e) {
  failed = true;
  console.error("Blob: failed", {
    reason:
      (e as Error).message === "configuration"
        ? "Invalid or missing Blob read/write token"
        : "Storage connection or authorization failed",
  });
}
console.log(
  "Admin credentials configured:",
  !!process.env.ADMIN_DEMO_EMAIL && !!process.env.ADMIN_DEMO_PASSWORD,
);
if (failed) process.exitCode = 1;
