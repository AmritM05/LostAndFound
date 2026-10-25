import { ApiError } from "./http";
import { categories } from "../reportFields";
export const uuid = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
export function reportInput(
  data: any,
  id?: string,
  type: "lost" | "found" = "lost",
) {
  const item = data?.item;
  if (typeof item?.locationKnown !== "boolean")
    throw new ApiError("Choose a known or unknown location.");
  if (
    !item ||
    !uuid(item.id) ||
    (id && id !== item.id) ||
    item.type !== type ||
    !categories.includes(item.category) ||
    typeof item.name !== "string" ||
    !item.name.trim() ||
    item.name.length > 150 ||
    typeof item.color !== "string" ||
    !item.color.trim()
  )
    throw new ApiError("Add a valid item, category, and color.");
  for (const key of [
    "brand",
    "model",
    "color",
    "secondaryColor",
    "size",
    "description",
    "features",
    "location",
  ])
    if (
      item[key] != null &&
      (typeof item[key] !== "string" ||
        item[key].length >
          (key === "description" || key === "features" ? 4000 : 200))
    )
      throw new ApiError("One of the report fields is too long.");
  if (
    typeof data.privateDetail !== "string" ||
    data.privateDetail.length > 4000
  )
    throw new ApiError("Ownership details must be under 4,000 characters.");
  if (
    !Array.isArray(data.imageIds) ||
    data.imageIds.length > 3 ||
    !data.imageIds.every(uuid)
  )
    throw new ApiError("Choose up to three uploaded images.");
  const time = Date.parse(item.date);
  if (!Number.isFinite(time) || time > Date.now() + 300000)
    throw new ApiError("Choose a valid past date.");
  return data;
}
