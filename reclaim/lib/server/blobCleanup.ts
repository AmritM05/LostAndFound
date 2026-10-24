import "server-only";
import { del } from "@vercel/blob";
import { query } from "./db";
import type { Query } from "./repository";
export async function processBlobCleanup(
  jobs: any[],
  run: Query = query,
  remove: (path: string) => Promise<unknown> = (path) => del(path),
) {
  let pending = 0;
  for (const job of jobs)
    try {
      await remove(job.blob_pathname);
      await run(
        "update blob_cleanup_jobs set completed_at=now(),attempts=attempts+1,last_error=null where id=$1 and completed_at is null",
        [job.id],
      );
    } catch (error) {
      pending++;
      const message = String(
        (error as Error).message || "Storage cleanup failed",
      )
        .split(process.env.BLOB_READ_WRITE_TOKEN || "__missing_token__")
        .join("[redacted]")
        .slice(0, 500);
      console.error(
        "[Magpie Blob cleanup] Photo deletion failed; durable retry queued.",
        { jobId: job.id, error: message },
      );
      try {
        await run(
          "update blob_cleanup_jobs set attempts=attempts+1,last_error=$2 where id=$1 and completed_at is null",
          [job.id, message],
        );
      } catch {
        console.error(
          "[Magpie Blob cleanup] Could not update retry metadata.",
          { jobId: job.id },
        );
      }
    }
  return { pending };
}
export async function cleanupReportPhotos(reportId: string, userId: string) {
  try {
    return await processBlobCleanup(
      await query(
        "select * from blob_cleanup_jobs where report_id=$1 and user_id=$2 and completed_at is null",
        [reportId, userId],
      ),
    );
  } catch {
    console.error(
      "[Magpie Blob cleanup] Cleanup query failed; report deletion succeeded and jobs remain queued.",
      { reportId },
    );
    return { pending: 1 };
  }
}
