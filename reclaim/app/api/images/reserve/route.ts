import {
  blobOperation,
  requireBlobConfiguration,
} from "../../../../lib/server/blob";
import { randomUUID } from "node:crypto";
import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../../lib/server/http";
import { requirePhotoUser } from "../../../../lib/server/session";
import { query } from "../../../../lib/server/db";
import { validateImage, imageType } from "../../../../lib/uploadConfig";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requirePhotoUser(request),
      data = await body(request);
    if (
      typeof data.name !== "string" ||
      data.name.length > 200 ||
      typeof data.type !== "string"
    )
      throw new ApiError("Choose a valid image.");
    const error = validateImage(data);
    if (error) throw new ApiError(error);
    requireBlobConfiguration();
    const [{ count }] = await query(
      "select count(*)::int as count from report_images where owner_id=$1 and created_at>now()-interval '1 hour'",
      [user.id],
    );
    if (count >= 30)
      throw new ApiError(
        "Too many photo uploads. Please try again later.",
        429,
      );
    const id = randomUUID(),
      type = imageType(data)!,
      ext = type.split("/")[1],
      path = `reports/${user.id}/${id}/original.${ext}`,
      preview = `reports/${user.id}/${id}/preview.webp`;
    await query(
      "insert into report_images(id,owner_id,filename,mime_type,byte_size,blob_pathname,preview_pathname,upload_role) values($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, user.id, data.name, type, data.size, path, preview, user.role],
    );
    return json(
      { id, pathname: path, previewPathname: preview, mimeType: type },
      201,
    );
  }, request);
}
