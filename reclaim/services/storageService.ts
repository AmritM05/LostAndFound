import { upload } from "@vercel/blob/client";
import { request } from "./apiClient";
import { imagePreview } from "../lib/imagePreview";
import { validateImage, MAX_IMAGES } from "../lib/uploadConfig";
const completed = new WeakMap<
  File,
  Partial<Record<"student" | "admin", string>>
>();
export async function uploadReportImages(
  files: File[],
  onProgress?: (percentage: number) => void,
  workspace: "student" | "admin" = "student",
): Promise<string[]> {
  if (files.length > MAX_IMAGES)
    throw new Error(`Choose up to ${MAX_IMAGES} images.`);
  const ids: string[] = [];
  const scope = workspace === "admin" ? "?workspace=admin" : "";
  for (let index = 0; index < files.length; index++) {
    const file = files[index],
      error = validateImage(file);
    if (error) throw new Error(error);
    const cached = completed.get(file)?.[workspace];
    if (cached) {
      ids.push(cached);
      continue;
    }
    const reserved = await request("/api/images/reserve/" + scope, {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        size: file.size,
      }),
    });
    await upload(reserved.pathname, file, {
      access: "private",
      contentType: reserved.mimeType,
      handleUploadUrl: "/api/images/upload/" + scope,
      multipart: file.size > 4 * 1024 * 1024,
      onUploadProgress: ({ percentage }) =>
        onProgress?.(
          Math.round(((index + percentage / 100) / files.length) * 90),
        ),
    });
    const preview = await imagePreview(file);
    let hasPreview = false;
    try {
      if (preview.blob && preview.blob.size <= 1024 * 1024) {
        await upload(reserved.previewPathname, preview.blob, {
          access: "private",
          contentType: "image/webp",
          handleUploadUrl: "/api/images/upload/" + scope,
        });
        hasPreview = true;
      }
    } catch {
      console.warn(
        "[Magpie photos] Preview upload failed; preserving original.",
      );
    } finally {
      if (preview.url) URL.revokeObjectURL(preview.url);
    }
    await request(`/api/images/${reserved.id}/complete/${scope}`, {
      method: "POST",
      body: JSON.stringify({ preview: hasPreview }),
    });
    completed.set(file, { ...completed.get(file), [workspace]: reserved.id });
    ids.push(reserved.id);
  }
  onProgress?.(100);
  return ids;
}
export async function getPrivatePhotoUrls(ids: string[]): Promise<string[]> {
  return ids.map((id) => `/api/images/${encodeURIComponent(id)}/`);
}
