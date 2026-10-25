import "server-only";
import { ApiError } from "./http";
import { ServiceFailure } from "./diagnostics";
export function requireBlobConfiguration() {
  if (!process.env.BLOB_READ_WRITE_TOKEN?.startsWith("vercel_blob_rw_"))
    throw new ServiceFailure(
      "storage.configure",
      "configuration",
      "Photo storage setup is incomplete. Ask the demo organizer to check the private Blob token.",
    );
}
export async function blobOperation<T>(
  operation: string,
  action: () => Promise<T>,
): Promise<T> {
  requireBlobConfiguration();
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError || error instanceof ServiceFailure)
      throw error;
    throw new ServiceFailure(
      operation,
      "connection",
      "Photo storage is unavailable. Please try again shortly.",
    );
  }
}
