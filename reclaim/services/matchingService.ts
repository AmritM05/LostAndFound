import { Item, Match } from "../lib/types";
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((x) => x.length > 2)
      .map(
        (x) => ({ clip: "keychain", silicone: "case", grey: "gray" })[x] || x,
      ),
  );
export function textSimilarity(a: string, b: string) {
  const x = tokens(a),
    y = tokens(b);
  return x.size && y.size
    ? (2 * [...x].filter((v) => y.has(v)).length) / (x.size + y.size)
    : 0;
}
export function distanceKm(a: Item, b: Item): number | null {
  if (
    a.lat == null ||
    a.lng == null ||
    b.lat == null ||
    b.lng == null ||
    ![a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)
  )
    return null;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dlat = rad(b.lat - a.lat),
    dlng = rad(b.lng - a.lng);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function calculateMatchScore(lost: Item, found: Item): Match {
  const distance = distanceKm(lost, found),
    minutes = Math.round(
      (+new Date(found.date) - +new Date(lost.date)) / 60000,
    );
  const category = lost.category === found.category ? 100 : 0;
  const brand =
    lost.brand && found.brand
      ? textSimilarity(
          lost.brand + " " + lost.model,
          found.brand + " " + found.model,
        ) * 100
      : 50;
  const color =
    lost.color.toLowerCase() === found.color.toLowerCase() ? 100 : 20;
  const text =
    textSimilarity(
      lost.name + " " + lost.description,
      found.name + " " + found.description,
    ) * 100;
  const factors: Record<string, number> = {
    "Visual attributes": Math.round(((category + color + brand) / 3) * 0.85),
    Description: Math.round(text),
    ...(distance === null
      ? {}
      : { Location: Math.round(Math.max(35, 100 - distance * 24)) }),
    Time: Math.round(Math.max(20, 100 - Math.abs(minutes) / 10)),
    "Brand & category": Math.round((category + brand) / 2),
  };
  const score = Math.min(
    99,
    Math.round(
      (category * 0.15 +
        brand * 0.15 +
        text * 0.2 +
        factors["Visual attributes"] * 0.25 +
        (distance === null ? 0 : factors.Location * 0.1) +
        factors.Time * 0.1 +
        textSimilarity(lost.features, found.features) * 5) /
        (distance === null ? 0.9 : 1),
    ),
  );
  return {
    id: `${lost.id}:${found.id}`,
    lostId: lost.id,
    foundId: found.id,
    score,
    factors,
    distance,
    minutes,
  };
}
export function findMatches(items: Item[]): Match[] {
  return items
    .filter(
      (i) => i.type === "lost" && !["Returned", "Archived"].includes(i.status),
    )
    .flatMap((l) =>
      items
        .filter(
          (i) =>
            i.type === "found" && !["Returned", "Archived"].includes(i.status),
        )
        .map((f) => calculateMatchScore(l, f)),
    )
    .filter((m) => m.score >= 60)
    .sort((a, b) => b.score - a.score);
}
