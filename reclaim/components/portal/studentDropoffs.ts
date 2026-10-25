import { campus, type CampusConfig } from "../../lib/campus";

// Frontend-only integration boundary. MAG-003 must publish its actual endpoint,
// response mapping and auth policy before a backend loader is supplied here.
// Only approved public intake guidance belongs in this projection.
export interface StudentDropoff {
  id: string;
  name: string;
  instructions: string;
  lat: number;
  lng: number;
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
