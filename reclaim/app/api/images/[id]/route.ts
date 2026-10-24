import { get } from "@vercel/blob";
import { endpoint, ApiError, json } from "../../../../lib/server/http";
import { requireUser } from "../../../../lib/server/session";
import { query } from "../../../../lib/server/db";
import { uuid } from "../../../../lib/server/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const user = await requireUser(request),
      { id } = await params;
    if (!uuid(id)) throw new ApiError("Image not found.", 404);
    const [image] = await query(
      "select * from report_images where id=$1 and owner_id=$2 and status='uploaded'",
      [id, user.id],
    );
    if (!image) throw new ApiError("Image not found.", 404);
    if (new URL(request.url).searchParams.get("metadata") === "1")
      return json({
        filename: image.filename,
        mimeType: image.mime_type,
        hasPreview: !!image.preview_url,
      });
    const original = new URL(request.url).searchParams.get("original") === "1";
    const preview = !original && !!image.preview_url;
    const result = await get(
      preview ? image.preview_pathname : image.blob_pathname,
      { access: "private", useCache: false },
    );
    if (!result || result.statusCode !== 200)
      throw new ApiError("Image unavailable.", 404);
    const type = preview ? "image/webp" : image.mime_type;
    const headers = new Headers({
      "Content-Type": type,
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    });
    if (
      original ||
      [
        "image/heic",
        "image/heif",
        "image/heic-sequence",
        "image/heif-sequence",
      ].includes(type)
    )
      headers.set(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(image.filename)}`,
      );
    return new Response(result.stream as ReadableStream, { headers });
  });
}
