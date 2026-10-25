import { randomUUID } from "node:crypto";
import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../../lib/server/http";
import { requireAdmin } from "../../../../lib/server/adminSession";
import { query } from "../../../../lib/server/db";
import { uuid } from "../../../../lib/server/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireAdmin(request),
      d = await body(request);
    if (!d || typeof d !== "object" || Array.isArray(d))
      throw new ApiError("Enter valid drop-off zone details.");
    if (
      d.studentVisible === true &&
      (typeof d.publicInstructions !== "string" || !d.publicInstructions.trim())
    )
      throw new ApiError(
        "Add public handover instructions before publishing this zone.",
      );
    if (
      (d.id && !uuid(d.id)) ||
      typeof d.name !== "string" ||
      !d.name.trim() ||
      d.name.length > 150 ||
      typeof d.instructions !== "string" ||
      d.instructions.length > 2000 ||
      typeof d.buildingId !== "string" ||
      !d.buildingId ||
      typeof d.active !== "boolean" ||
      (d.studentVisible !== undefined &&
        typeof d.studentVisible !== "boolean") ||
      (d.publicInstructions !== undefined &&
        (typeof d.publicInstructions !== "string" ||
          d.publicInstructions.length > 2000)) ||
      (d.studentVisible === true &&
        (typeof d.publicInstructions !== "string" ||
          !d.publicInstructions.trim())) ||
      !Number.isFinite(d.lat) ||
      !Number.isFinite(d.lng) ||
      Math.abs(d.lat) > 90 ||
      Math.abs(d.lng) > 180
    )
      throw new ApiError(
        "Enter a name, building, instructions and valid coordinates.",
      );
    const rows = await query(
      `with saved as (insert into dropoff_zones(id,building_id,name,instructions,latitude,longitude,active,student_visible,public_instructions) select $1,id,$3,$4,$5,$6,$7,$9,$10 from buildings where id=$2 and active on conflict(id) do update set building_id=excluded.building_id,name=excluded.name,instructions=excluded.instructions,latitude=excluded.latitude,longitude=excluded.longitude,active=excluded.active,student_visible=excluded.student_visible,public_instructions=excluded.public_instructions returning id) insert into staff_activity(staff_id,action) select $8,'Updated drop-off zone' from saved returning id`,
      [
        d.id || randomUUID(),
        d.buildingId,
        d.name.trim(),
        d.instructions,
        d.lat,
        d.lng,
        d.active,
        user.id,
        d.studentVisible === true,
        typeof d.publicInstructions === "string"
          ? d.publicInstructions.trim()
          : "",
      ],
    );
    if (!rows.length) throw new ApiError("Select an active campus building");
    return json({ ok: true });
  }, request);
}
