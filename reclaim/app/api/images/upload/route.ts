import {
  MAX_IMAGE_UPLOAD_BYTES,
  validateImage,
} from "../../../../lib/uploadConfig";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../../lib/server/http";
import { requireUser } from "../../../../lib/server/session";
import { query } from "../../../../lib/server/db";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    const data = (await body(request)) as HandleUploadBody;
    const result = await handleUpload({
      body: data,
      request,
      onBeforeGenerateToken: async (pathname) => {
        sameOrigin(request);
        const user = await requireUser(request);
        const [image] = await query(
          "select * from report_images where owner_id=$1 and (blob_pathname=$2 or preview_pathname=$2) and report_id is null and created_at>now()-interval '15 minutes'",
          [user.id, pathname],
        );
        if (!image)
          throw new ApiError(
            "This upload is unavailable. Select the image again.",
            403,
          );
        const policyError = validateImage({
          name: image.filename,
          type: image.mime_type,
          size: Number(image.byte_size),
        });
        if (policyError) throw new ApiError(policyError);
        const preview = image.preview_pathname === pathname;
        return {
          allowedContentTypes: [preview ? "image/webp" : image.mime_type],
          maximumSizeInBytes: preview
            ? 1024 * 1024
            : Math.min(MAX_IMAGE_UPLOAD_BYTES, Number(image.byte_size)),
          validUntil: Date.now() + 15 * 60000,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ id: image.id }),
        };
      },
      // SDK verifies completion callbacks; the authenticated completion route verifies Blob metadata itself.
      onUploadCompleted: async () => {},
    });
    return json(result);
  });
}
