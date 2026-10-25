import "server-only";
import sharp from "sharp";
import { get } from "@vercel/blob";
import { blobOperation } from "../blob";
import { bounded } from "./embeddings";
export interface AIImage {
  id: string;
  report_id: string;
  owner_id: string;
  upload_role: string;
  status: string;
  mime_type: string;
  byte_size: number;
  blob_pathname: string;
  preview_pathname?: string | null;
  preview_url?: string | null;
}
const MAX_BYTES = 25 * 1024 * 1024,
  MAX_PIXELS = 24_000_000;
export function assertImageAccess(
  image: AIImage,
  report: { id: string; reporterId: string; type: string },
) {
  if (
    image.report_id !== report.id ||
    image.owner_id !== report.reporterId ||
    image.upload_role !== (report.type === "lost" ? "student" : "admin") ||
    image.status !== "uploaded" ||
    !Number.isFinite(Number(image.byte_size)) ||
    Number(image.byte_size) <= 0 ||
    Number(image.byte_size) > MAX_BYTES
  )
    throw Error("Image unavailable");
}
export async function imageToJpeg(
  bytes: Buffer,
  mime: string,
  decodeHeic?: any,
): Promise<Buffer> {
  if (!bytes.length || bytes.length > MAX_BYTES) throw Error("Image too large");
  let pipeline;
  if (/^image\/hei[cf]/.test(mime)) {
    const decoder = decodeHeic || (await import("heic-decode")).default;
    const images = await decoder.all({ buffer: bytes });
    try {
      const first = images[0];
      if (
        !first ||
        first.width * first.height > MAX_PIXELS ||
        first.width < 1 ||
        first.height < 1
      )
        throw Error("Image dimensions unsupported");
      const decoded = await first.decode();
      pipeline = sharp(Buffer.from(decoded.data), {
        raw: { width: decoded.width, height: decoded.height, channels: 4 },
        limitInputPixels: MAX_PIXELS,
      });
    } finally {
      images.dispose();
    }
  } else {
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime))
      throw Error("Image format unsupported");
    pipeline = sharp(bytes, {
      limitInputPixels: MAX_PIXELS,
      failOn: "warning",
    });
  }
  const output = await pipeline
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80 })
    .timeout({ seconds: 4 })
    .toBuffer();
  if (output.length > 2 * 1024 * 1024) throw Error("Prepared image too large");
  return output;
}
async function readPrivate(path: string, limit: number): Promise<Buffer> {
  if (!path || /^https?:/i.test(path)) throw Error("Invalid storage path");
  const controller = new AbortController();
  const result = await bounded(
    blobOperation("storage.ai-read", () =>
      get(path, {
        access: "private",
        useCache: false,
        abortSignal: controller.signal,
      }),
    ),
    5000,
    () => controller.abort(),
  );
  if (!result || result.statusCode !== 200)
    throw Error("Private image unavailable");
  const reader = (result.stream as ReadableStream<Uint8Array>).getReader();
  let size = 0;
  const deadline = Date.now() + 5000;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const part = await bounded(
        reader.read(),
        Math.max(1, deadline - Date.now()),
        () => controller.abort(),
      );
      if (part.done) break;
      size += part.value.length;
      if (size > limit) throw Error("Image too large");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}
export async function authorizedImage(
  image: AIImage,
  report: { id: string; reporterId: string; type: string },
  read = readPrivate,
) {
  assertImageAccess(image, report);
  // Existing private WebP previews already handle most large/HEIC originals.
  if (image.preview_pathname && image.preview_url) {
    try {
      return await imageToJpeg(
        await read(image.preview_pathname, 1024 * 1024),
        "image/webp",
      );
    } catch {
      /* A failed optional preview must not break the original. */
    }
  }
  return imageToJpeg(
    await read(image.blob_pathname, MAX_BYTES),
    image.mime_type,
  );
}
