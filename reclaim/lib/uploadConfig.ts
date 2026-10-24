const configured = Number(process.env.NEXT_PUBLIC_MAX_IMAGE_UPLOAD_MB || 25);
export const MAX_IMAGE_UPLOAD_MB =
  Number.isFinite(configured) && configured > 0 && configured <= 100
    ? configured
    : 25;
export const MAX_IMAGE_BYTES = MAX_IMAGE_UPLOAD_MB * 1024 * 1024;
export const MAX_IMAGES = 3;
export const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";
const types: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};
export function imageType(file: { name: string; type: string }) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (["heic", "heif"].includes(extension || "")) return types[extension!];
  return Object.values(types).includes(file.type)
    ? file.type
    : !file.type || file.type === "application/octet-stream"
      ? types[extension!]
      : undefined;
}
export function validateImage(file: {
  name: string;
  type: string;
  size: number;
}) {
  if (!imageType(file)) return "Choose a JPEG, PNG, WebP, HEIC, or HEIF image.";
  if (file.size > MAX_IMAGE_BYTES)
    return `This image is larger than the ${MAX_IMAGE_UPLOAD_MB} MB upload limit.`;
  if (!Number.isFinite(file.size) || file.size <= 0)
    return "This image is empty or invalid.";
  return null;
}
