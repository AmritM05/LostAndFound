import { campus, type CampusConfig } from "../../lib/campus";

// Frontend-only integration boundary. MAG-003 must publish its actual endpoint,
// response mapping and auth policy before a backend loader is supplied here.
// Only approved public intake guidance belongs in this projection.
export interface StudentDropoff {
  id: string;
  name: string;
  instructions: string;
  building?: string;
  lat: number | null;
  lng: number | null;
}
export interface StudentDropoffResult {
  zones: StudentDropoff[];
  source: "campus-config" | "approved-api";
}
export type StudentDropoffLoader = () => Promise<StudentDropoffResult>;
export async function configuredDropoffs(
  config: CampusConfig = campus,
): Promise<StudentDropoffResult> {
  return {
    source: "campus-config",
    zones: config.locations
      .filter((l) => l.kind === "dropoff" && l.active !== false)
      .map((l) => ({
        id: l.id,
        name: l.name,
        instructions: l.hours,
        lat: l.lat,
        lng: l.lng,
      })),
  };
}

// Defend the student UI boundary without inventing a backend endpoint. Only a
// reviewed loader may label its data approved-api; production still uses config.
export function publicDropoffResult(value: unknown): StudentDropoffResult {
  const data = value as StudentDropoffResult;
  if (!data || !["campus-config", "approved-api"].includes(data.source) || !Array.isArray(data.zones))
    throw new Error("Invalid student drop-off guidance");
  return {
    source: data.source,
    zones: data.zones.filter(zone => {
      // A reviewed API must enforce visibility/approval; explicit contrary flags
      // are still rejected here so stale or misconfigured loaders fail closed.
      if (!zone || typeof zone !== "object") return true;
      return !["active", "approved", "studentVisible"].some(key =>
        key in zone && (zone as unknown as Record<string, unknown>)[key] !== true);
    }).map(zone => {
      if (!zone || typeof zone.id !== "string" || !zone.id.trim() || typeof zone.name !== "string" || !zone.name.trim() || typeof zone.instructions !== "string")
        throw new Error("Invalid student drop-off location");
      const coordinates = typeof zone.lat === "number" && Number.isFinite(zone.lat) && Math.abs(zone.lat) <= 90
        && typeof zone.lng === "number" && Number.isFinite(zone.lng) && Math.abs(zone.lng) <= 180;
      return {
        id: zone.id, name: zone.name, instructions: zone.instructions,
        ...(typeof zone.building === "string" ? { building: zone.building } : {}),
        lat: coordinates ? zone.lat : null, lng: coordinates ? zone.lng : null,
      };
    }),
  };
}
