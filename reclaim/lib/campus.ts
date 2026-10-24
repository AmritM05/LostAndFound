import osuColumbus from "./campuses/osu-columbus.json";
export interface CampusLocation {
  id: string;
  name: string;
  aliases?: string[];
  address?: string;
  active?: boolean;
  lat: number;
  lng: number;
  hours: string;
  kind: "dropoff" | "building";
}
export interface CampusConfig {
  id: string;
  name: string;
  center: { lat: number; lng: number };
  locations: CampusLocation[];
  allowedDomains: string[];
  pickupName: string;
}
const coordinate = (
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
) => {
  const n = Number(raw);
  return raw?.trim() && Number.isFinite(n) && n >= min && n <= max
    ? n
    : fallback;
};
const validPoint = (p: { lat: number; lng: number }) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;
const fallback: CampusConfig = {
  id: "osu-columbus",
  name: process.env.NEXT_PUBLIC_CAMPUS_NAME || osuColumbus.name,
  center: {
    lat: coordinate(
      process.env.NEXT_PUBLIC_CAMPUS_LAT,
      osuColumbus.center.lat,
      -90,
      90,
    ),
    lng: coordinate(
      process.env.NEXT_PUBLIC_CAMPUS_LNG,
      osuColumbus.center.lng,
      -180,
      180,
    ),
  },
  locations: osuColumbus.locations as CampusLocation[],
  allowedDomains: (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  pickupName:
    process.env.NEXT_PUBLIC_PICKUP_LOCATION || "Campus information desk",
};
export function parseCampusConfig(raw?: string): CampusConfig {
  if (!raw) return fallback;
  try {
    const data = JSON.parse(raw);
    const center =
      data.center && validPoint(data.center) ? data.center : fallback.center;
    const locations = Array.isArray(data.locations)
      ? data.locations
          .filter(
            (l: CampusLocation) =>
              typeof l.name === "string" &&
              typeof l.id === "string" &&
              validPoint(l),
          )
          .map((l: CampusLocation) => ({
            ...l,
            hours: l.hours || "Contact the campus desk",
            kind: l.kind === "dropoff" ? "dropoff" : "building",
          }))
      : [];
    return {
      ...fallback,
      id: typeof data.id === "string" ? data.id : "custom-campus",
      name: typeof data.name === "string" ? data.name : fallback.name,
      center,
      locations,
    };
  } catch {
    return fallback;
  }
}
export const campus = parseCampusConfig(process.env.NEXT_PUBLIC_CAMPUS_CONFIG);
export function universityEmail(
  email: string,
  domains = campus.allowedDomains,
) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) return false;
  const domain = normalized.split("@")[1];
  return domains.length ? domains.includes(domain) : true;
}

export function searchBuildings(
  query: string,
  locations: CampusLocation[] = campus.locations,
) {
  const text = query.trim().toLowerCase();
  return locations
    .filter(
      (l) =>
        l.active !== false &&
        [l.name, ...(l.aliases || [])].some((n) =>
          n.toLowerCase().includes(text),
        ),
    )
    .sort((a, b) => {
      const ap = a.name.toLowerCase().startsWith(text),
        bp = b.name.toLowerCase().startsWith(text);
      return ap === bp ? a.name.localeCompare(b.name) : ap ? -1 : 1;
    });
}
