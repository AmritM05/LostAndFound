// Authoritative per-image policy, shared by picker, drop, service, and upload routes.
export const MAX_IMAGE_UPLOAD_MB = 25;
export const MAX_IMAGE_UPLOAD_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
export const MAX_IMAGE_BYTES = MAX_IMAGE_UPLOAD_BYTES;
export const MAX_IMAGES = 3;
export const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.jpg,.jpeg,.png,.webp,.heic,.heif";
const extensions: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};
const mimeAliases: Record<string, string> = {
  "image/heic-sequence": "image/heic",
  "image/heif-sequence": "image/heif",
};
export function imageType(file: { name: string; type: string }) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mime = file.type.toLowerCase().split(";")[0].trim();
  // iPhone exports can supply an empty, generic, or incorrect MIME type.
  if (extension === "heic" || extension === "heif")
    return extensions[extension];
  if (mimeAliases[mime]) return mimeAliases[mime];
  if (Object.values(extensions).includes(mime)) return mime;
  return !mime || mime === "application/octet-stream"
    ? extensions[extension!]
    : undefined;
}
export function isSupportedImage(file: { name: string; type: string }) {
  return !!imageType(file);
}
export function validateImage(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (!isSupportedImage(file))
    return "Choose a JPEG, PNG, WebP, HEIC, or HEIF image.";
  if (file.size > MAX_IMAGE_UPLOAD_BYTES)
    return "This image is larger than the 25 MB upload limit.";
  if (!Number.isFinite(file.size) || file.size <= 0)
    return "This image is empty or invalid.";
  return null;
}
