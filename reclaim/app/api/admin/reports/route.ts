import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../../lib/server/http";
import { requireAdmin } from "../../../../lib/server/adminSession";
import { query } from "../../../../lib/server/db";
import { adminRepository } from "../../../../lib/server/adminRepository";
import { reportInput, uuid } from "../../../../lib/server/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireAdmin(request);
    const data = reportInput(await body(request), undefined, "found");
    if (
      !uuid(data.item.dropoffZoneId) ||
      !Number.isFinite(Date.parse(data.item.receivedAt)) ||
      typeof data.item.staffNotes !== "string" ||
      data.item.staffNotes.length > 4000
    )
      throw new ApiError(
        "Choose a drop-off zone, received time, and valid staff notes.",
      );
    await adminRepository(query).saveFound(user.id, data);
    return json({ id: data.item.id }, 201);
  }, request);
}
