import policy from "./matchingPolicy.json";
import type { Item } from "../lib/types";

export { policy as matchingPolicy };
const lookup = (map: Record<string, string>, key: string): string | undefined =>
  Object.hasOwn(map, key) ? map[key] : undefined;
export type MatchingItem = Item & {
  /** Explicit full identifiers only; never inferred from prose/fragments. */
  identifiers?: Record<string, string>;
  uncertainAttributes?: string[];
};
export const normalizedText = (value: unknown): string =>
  typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim() : "";
export function knownText(value: unknown): string | null {
  if (typeof value !== "string" || /[?\/]|\b(maybe|possibly|probably|uncertain|unsure|unknown|guess|guessed)\b/i.test(value)) return null;
  const text = normalizedText(value);
  return policy.unknown.includes(text) ? null : text;
}
export function normalizeAttribute(kind: "brand" | "category" | "color", value: unknown): string | null {
  const text = knownText(value);
  if (!text) return null;
  if (kind === "brand" && /\b(and|or|either|not)\b/.test(text)) return null;
  if (kind === "brand" && typeof value === "string" && value.includes("&") && !lookup(policy.brand, text)) return null;
  return lookup(policy[kind], text) || (kind === "brand" ? text : null);
}
export function normalizeModel(value: unknown, brand?: string, name?: string): string | null {
  let text = knownText(value);
  if (!text) return null;
  if (/\b(or|either|not)\b/.test(text)) return null;
  text = text.replace(/\bair pods\b/g, "airpods")
    .replace(/\b(first|1st) (gen|generation)\b/g, "1")
    .replace(/\b(second|2nd) (gen|generation)\b/g, "2")
    .replace(/\b(third|3rd) (gen|generation)\b/g, "3")
    .replace(/\b(fourth|4th) (gen|generation)\b/g, "4")
    .replace(/\b(gen|generation) ?([1-4])\b/g, "$2");
  for (const prefix of [knownText(brand), normalizeAttribute("brand", brand)])
    if (prefix && text.startsWith(prefix + " ")) text = text.slice(prefix.length + 1);
  // A numeric phone designation may omit its family while intake includes it.
  // Qualify only with a known Apple brand and an unambiguous phone item type;
  // keep every generation and variant token for contradiction checks.
  if (normalizeAttribute("brand", brand) === "apple" && normalizeItemType(name) === "phone" &&
      /^\d{1,2}( (pro|max|plus|mini|e|air))*$/.test(text)) text = `iphone ${text}`;
  text = lookup(policy.model, text) || text;
  if (policy.genericModels.includes(text)) return null;
  const recognized = policy.modelFamilies.some(f => text === f || text.startsWith(f + " "));
  // Older clients/fixtures copy generic item names into model.
  if (!recognized && !/\d/.test(text) && text === normalizedText(name)) return null;
  return text;
}
export function compatibleModels(a: string, b: string): boolean {
  return a.replace(/ /g, "") === b.replace(/ /g, "") || policy.modelFamilies.some(f => (a === f && b.startsWith(f + " ")) || (b === f && a.startsWith(f + " ")));
}
export function compatibleColors(a: string, b: string): boolean {
  const family = (v: string) => lookup(policy.colorFamily, v) || v;
  return family(a) === family(b) || policy.colorNeighbors.some(pair => pair.includes(a) && pair.includes(b));
}
export function normalizeItemType(value: unknown): string | null {
  const text = knownText(value);
  if (!text || /\b(case|cover)\b/.test(text)) return null;
  const types = Object.entries(policy.itemTypes).filter(([, words]) => words.some(w => (" " + text + " ").includes(" " + w + " "))).map(([type]) => type);
  return types.length === 1 ? types[0] : null;
}
export function normalizedIdentifiers(input: MatchingItem): Record<string, string> {
  const result: Record<string, string> = {};
  const conflicted = new Set<string>();
  if (input.uncertainAttributes?.includes("identifiers")) return result;
  for (const [key, value] of Object.entries(input.identifiers || {})) {
    const kind = lookup(policy.identifierKinds, normalizedText(key));
    const text = knownText(value);
    if (!kind || !text || conflicted.has(kind)) continue;
    const normalized = text.replace(/ /g, "");
    if (result[kind] && result[kind] !== normalized) {
      delete result[kind];
      conflicted.add(kind);
    } else result[kind] = normalized;
  }
  return result;
}
export function normalizeMatchingItem(item: MatchingItem) {
  const value = (key: string, raw: unknown) => item.uncertainAttributes?.includes(key) ? null : raw;
  return {
    category: normalizeAttribute("category", value("category", item.category)),
    type: normalizeItemType(value("type", item.name)),
    brand: normalizeAttribute("brand", value("brand", item.brand)),
    model: normalizeModel(value("model", item.model), item.brand, item.name),
    color: normalizeAttribute("color", value("color", item.color)),
    identifiers: normalizedIdentifiers(item),
  };
}
