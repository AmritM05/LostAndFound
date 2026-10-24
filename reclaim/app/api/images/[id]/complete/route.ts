import { head } from "@vercel/blob";
import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../../../lib/server/http";
import { requireUser } from "../../../../../lib/server/session";
import { query } from "../../../../../lib/server/db";
import { uuid } from "../../../../../lib/server/validation";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireUser(request),
      { id } = await params,
      data = await body(request);
    if (!uuid(id)) throw new ApiError("Image not found.", 404);
    const [image] = await query(
      "select * from report_images where id=$1 and owner_id=$2 and report_id is null",
      [id, user.id],
    );
    if (!image) throw new ApiError("Image not found.", 404);
    const blob = await head(image.blob_pathname);
    if (
      !new URL(blob.url).hostname.endsWith(
        ".private.blob.vercel-storage.com",
      ) ||
      blob.pathname !== image.blob_pathname ||
      blob.size !== Number(image.byte_size) ||
      blob.contentType !== image.mime_type
    )
      throw new ApiError("The private image upload could not be verified.");
    let previewUrl: string | null = null;
    if (data.preview === true) {
      const preview = await head(image.preview_pathname);
      if (
        !new URL(preview.url).hostname.endsWith(
          ".private.blob.vercel-storage.com",
        ) ||
        preview.size > 1024 * 1024 ||
        preview.contentType !== "image/webp"
      )
        throw new ApiError("The image preview could not be verified.");
      previewUrl = preview.url;
    }
    await query(
      "update report_images set blob_url=$1,preview_url=$2,status='uploaded' where id=$3 and owner_id=$4",
      [blob.url, previewUrl, id, user.id],
    );
    return json({ id });
  });
}
