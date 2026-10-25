import { rankPotentialMatches } from "../lib/matchVisibility";
import type { Item, Match } from "../lib/types";
import {
  type MatchingItem, matchingPolicy, normalizedText, knownText,
  normalizeMatchingItem, compatibleModels, compatibleColors,
} from "./matchingAttributes";

const tokens = (value: unknown) => new Set(normalizedText(value).split(/\s+/)
  .filter(x => x.length > 2)
  .map(x => x === "clip" ? "keychain" : x === "silicone" ? "case" : x === "grey" ? "gray" : x));
export function textSimilarity(a: string, b: string) {
  const x = tokens(a), y = tokens(b);
  return x.size && y.size ? 2 * [...x].filter(v => y.has(v)).length / (x.size + y.size) : 0;
}
export function distanceKm(a: Item, b: Item): number | null {
  if ([a.lat, a.lng, b.lat, b.lng].some(v => v == null || !Number.isFinite(v)) ||
      Math.abs(a.lat!) > 90 || Math.abs(b.lat!) > 90 || Math.abs(a.lng!) > 180 || Math.abs(b.lng!) > 180) return null;
  const rad = (v: number) => v * Math.PI / 180;
  const h = Math.min(1, Math.max(0, Math.sin(rad(b.lat! - a.lat!) / 2) ** 2 +
    Math.cos(rad(a.lat!)) * Math.cos(rad(b.lat!)) * Math.sin(rad(b.lng! - a.lng!) / 2) ** 2));
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
export type MatchClassification = "very_strong_match" | "strong_match" | "possible_match" | "weak_match" | "no_match";
export interface MatchingSignals {
  /** Optional measured similarities on [0,1]. No provider is called here. */
  imageSimilarity?: number | null;
  semanticSimilarity?: number | null;
}
export interface MatchAssessment extends Match {
  eligible: boolean;
  classification: MatchClassification;
  contradictions: string[];
  matchingFactors: string[];
  policyVersion: string;
}
export function classifyMatch(score: number): MatchClassification {
  return score >= 90 ? "very_strong_match" : score >= 75 ? "strong_match" : score >= 60 ? "possible_match" : "weak_match";
}
/** Detailed reasoning is private staff evidence; never copy into owner/public DTOs. */
export function assessMatch(lost: MatchingItem, found: MatchingItem, signals: MatchingSignals = {}): MatchAssessment {
  const a = normalizeMatchingItem(lost), b = normalizeMatchingItem(found);
  const contradictions: string[] = [];
  for (const key of ["category", "type", "brand"] as const)
    if (a[key] && b[key] && a[key] !== b[key]) contradictions.push(`${key[0].toUpperCase() + key.slice(1)} mismatch: ${a[key]} versus ${b[key]}`);
  if (a.model && b.model && !compatibleModels(a.model, b.model)) contradictions.push(`Model mismatch: ${a.model} versus ${b.model}`);
  if (a.color && b.color && !compatibleColors(a.color, b.color)) contradictions.push(`Color mismatch: ${a.color} versus ${b.color}`);
  for (const key of Object.keys(a.identifiers).sort())
    if (b.identifiers[key] && a.identifiers[key] !== b.identifiers[key]) contradictions.push(`Conflicting identifier: ${key}`);
  if ([lost.status, found.status].some(s => ["Returned", "Archived", "Ready for Pickup"].includes(s))) contradictions.push("Report is closed or assigned");
  if (lost.type !== "lost" || found.type !== "found") contradictions.push("Expected a lost and found pair");
  const distance = distanceKm(lost, found);
  const delta = (+new Date(found.date) - +new Date(lost.date)) / 60000;
  const base = { id: `${lost.id}:${found.id}`, lostId: lost.id, foundId: found.id, distance,
    minutes: Number.isFinite(delta) ? Math.floor(delta + 0.5) : 0, policyVersion: matchingPolicy.version };
  if (contradictions.length) return { ...base, eligible: false, classification: "no_match", contradictions, matchingFactors: [], score: 0, factors: {} };
  const factors: Record<string, number> = {}, matchingFactors: string[] = [];
  let numerator = 0, denominator = 0;
  const add = (name: string, score: number, weight: number) => {
    factors[name] = Math.round(score); numerator += factors[name] * weight; denominator += weight;
  };
  const attrs: number[] = [];
  for (const key of ["category", "type", "brand", "model"] as const) if (a[key] && b[key]) {
    attrs.push(key === "model" && a.model.replace(/ /g, "") !== b.model.replace(/ /g, "") ? 85 : 100);
    matchingFactors.push(key === "model" ? "Compatible model" : `Same ${key}`);
  }
  if (attrs.length) add("Brand & category", attrs.reduce((sum, v) => sum + v, 0) / attrs.length, 20);
  if (a.color && b.color) { add("Color/details", a.color === b.color ? 100 : 90, 10); matchingFactors.push("Compatible color"); }
  const validSignal = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
  const lexical = knownText(lost.description) && knownText(found.description) && tokens(lost.description).size && tokens(found.description).size
    ? textSimilarity(`${lost.name} ${lost.description}`, `${found.name} ${found.description}`) * 100 : null;
  const semantic = validSignal(signals.semanticSimilarity) ? signals.semanticSimilarity * 100 : null;
  const description = lexical === null ? semantic : semantic === null ? lexical : (lexical + semantic) / 2;
  if (description !== null) { add("Description", description, 20); if (description >= 60) matchingFactors.push("Similar description"); }
  if (validSignal(signals.imageSimilarity)) { add("Image similarity", signals.imageSimilarity * 100, 30); if (signals.imageSimilarity >= 0.6) matchingFactors.push("Similar images"); }
  if (distance !== null) add("Location", Math.max(35, 100 - distance * 24), 10);
  if (Number.isFinite(delta)) add("Time", Math.max(20, 100 - Math.abs(base.minutes) / 10), 10);
  const score = denominator ? Math.min(99, Math.round(numerator / denominator)) : 0;
  return { ...base, eligible: true, classification: classifyMatch(score), contradictions: [], matchingFactors, score, factors };
}
/** Preserve the established student-safe Match shape; private assessment is separate. */
export function calculateMatchScore(lost: Item, found: Item): Match {
  const { id, lostId, foundId, score, factors, distance, minutes } = assessMatch(lost, found);
  return { id, lostId, foundId, score, factors, distance, minutes };
}
export function findMatches(items: Item[]): Match[] {
  const unique = [...new Map(items.map(i => [i.id, i])).values()];
  return rankPotentialMatches(unique.filter(i => i.type === "lost").flatMap(l =>
    unique.filter(i => i.type === "found").map(f => calculateMatchScore(l, f))));
}
