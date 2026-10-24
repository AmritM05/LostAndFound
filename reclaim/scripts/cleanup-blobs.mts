import { neon } from "@neondatabase/serverless";
import { processBlobCleanup } from "../lib/server/blobCleanup";
if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    "Configure DATABASE_URL and BLOB_READ_WRITE_TOKEN before retrying photo cleanup.",
  );
  process.exit(1);
}
try {
  const sql = neon(process.env.DATABASE_URL);
  const run = async (text: string, values: any[] = []) =>
    (await sql.query(text, values)) as any[];
  const jobs = await run(
    "select * from blob_cleanup_jobs where completed_at is null order by created_at limit 100",
  );
  const { pending } = await processBlobCleanup(jobs, run);
  console.log(
    `Processed ${jobs.length} photo cleanup jobs; ${pending} still pending.`,
  );
  if (pending) process.exitCode = 1;
} catch {
  console.error("Photo cleanup could not connect. Pending jobs are retained.");
  process.exitCode = 1;
}
