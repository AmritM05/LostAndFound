import { imageType } from "./uploadConfig";
export interface Preview {
  blob?: Blob;
  url?: string;
  warning?: string;
}
const cache = new WeakMap<File, Promise<Preview>>();
async function prepare(file: File): Promise<Preview> {
  let source: Blob = file;
  try {
    if (["image/heic", "image/heif"].includes(imageType(file) || "")) {
      const { default: convert } = await import("heic2any");
      const converted = await convert({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });
      source = Array.isArray(converted) ? converted[0] : converted;
    }
    const bitmap = await createImageBitmap(source, {
      imageOrientation: "from-image",
    });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      throw new Error("Canvas unavailable");
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error("Preview unavailable")),
        "image/webp",
        0.82,
      ),
    );
    return { blob };
  } catch (error) {
    console.warn(
      "[Magpie photos] Preview conversion unavailable",
      error instanceof Error
        ? error.message
        : String(
            (error as { message?: string })?.message ||
              "Unsupported image codec",
          ),
    );
    return {
      warning:
        "Preview unavailable for this image. The original file can still be uploaded and downloaded.",
    };
  }
}

export async function imagePreview(file: File): Promise<Preview> {
  let task = cache.get(file);
  if (!task) {
    task = new Promise<Preview>((resolve) => {
      const timer = setTimeout(
        () =>
          resolve({
            warning:
              "Preview unavailable for this image. The original file can still be uploaded and downloaded.",
          }),
        12000,
      );
      prepare(file).then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        () => {
          clearTimeout(timer);
          resolve({
            warning:
              "Preview unavailable. The original file can still be uploaded.",
          });
        },
      );
    });
    cache.set(file, task);
  }
  const result = await task;
  return {
    ...result,
    url: result.blob ? URL.createObjectURL(result.blob) : undefined,
  };
}
