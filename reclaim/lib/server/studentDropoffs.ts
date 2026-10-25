import type { DropoffZone } from "../types";
import type { Query } from "./repository";
import { uuid } from "./validation";
import { endpoint, json } from "./http";

// Deliberately separate public handover instructions from staff instructions.
// Coordinates describe the public building, never a zone's private storage point.
export function studentDropoffProjection(
  row: Record<string, unknown>,
  campusId: string,
): DropoffZone | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  if (
    row.active !== true ||
    row.student_visible !== true ||
    !uuid(row.id) ||
    typeof row.name !== "string" ||
    !row.name.trim() ||
    row.name.length > 150 ||
    typeof row.public_instructions !== "string" ||
    !row.public_instructions.trim() ||
    row.public_instructions.length > 2000 ||
    (row.building_id != null &&
      (typeof row.building_id !== "string" ||
        !row.building_id.trim() ||
        typeof row.building !== "string" ||
        !row.building.trim()))
  )
    return null;
  const coordinates =
    typeof row.building_id === "string" &&
    typeof row.public_lat === "number" &&
    Number.isFinite(row.public_lat) &&
    Math.abs(row.public_lat) <= 90 &&
    typeof row.public_lng === "number" &&
    Number.isFinite(row.public_lng) &&
    Math.abs(row.public_lng) <= 180;
  return {
    id: row.id as string,
    campusId,
    name: row.name.trim(),
    buildingId: typeof row.building_id === "string" ? row.building_id : null,
    building:
      typeof row.building_id === "string" && typeof row.building === "string"
        ? row.building
        : "",
    description: row.public_instructions.trim(),
    lat: coordinates ? (row.public_lat as number) : null,
    lng: coordinates ? (row.public_lng as number) : null,
    active: true,
  };
}
export async function listStudentDropoffs(
  query: Query,
  campusId: string,
): Promise<DropoffZone[]> {
  const rows = await query(
    `select z.id,z.name,z.active,z.student_visible,z.public_instructions,
    b.id as building_id,b.name as building,b.latitude as public_lat,b.longitude as public_lng
    from dropoff_zones z left join buildings b on b.id=z.building_id
    where z.active=true and z.student_visible=true
      and (z.building_id is null or (b.active=true and b.campus_id=$1))
    order by z.name,z.id`,
    [campusId],
  );
  return rows
    .map((row) => studentDropoffProjection(row, campusId))
    .filter((zone): zone is DropoffZone => zone !== null);
}
// Injectable boundary permits authenticated/error-path tests without live services.
export function studentDropoffEndpoint(dependencies: {
  requireStudent: (request: Request) => Promise<unknown>;
  query: Query;
  campusId: string;
}) {
  return (request: Request) =>
    endpoint(async () => {
      await dependencies.requireStudent(request);
      const response = json(
        await listStudentDropoffs(dependencies.query, dependencies.campusId),
      );
      response.headers.set("Vary", "Cookie");
      return response;
    }, request);
}
