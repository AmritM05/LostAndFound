import "server-only";
import {
  assessMatch,
  type MatchingSignals,
} from "../../../services/matchingService";
import { knownText, type MatchingItem } from "../../../services/matchingAttributes";
import {
  cosineSimilarity,
  disabledReason,
  type EmbeddingService,
} from "./embeddings";
export const DEFAULT_AI_WEIGHTS = {
  "Image similarity": 30,
  Description: 20,
  "Brand & category": 20,
  "Color/details": 10,
  Location: 10,
  Time: 10,
};
export function aiWeights(raw?: string) {
  try {
    const v = raw ? JSON.parse(raw) : {};
    if (Object.keys(v).some((k) => !(k in DEFAULT_AI_WEIGHTS))) throw Error();
    const result = { ...DEFAULT_AI_WEIGHTS, ...v };
    if (
      Object.values(result).some(
        (n) =>
          typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > 100,
      )
    )
      throw Error();
    return result;
  } catch {
    return { ...DEFAULT_AI_WEIGHTS };
  }
}
export interface AIReport {
  item: MatchingItem;
  revision: string;
  image?: { id: string };
  loadImage?: () => Promise<Buffer>;
}
export async function compareWithGemini(
  lost: AIReport,
  found: AIReport,
  provider: EmbeddingService,
) {
  const baseline = assessMatch(lost.item, found.item);
  if (!baseline.eligible)
    return {
      assessment: baseline,
      signals: {} as MatchingSignals,
      channels: [] as string[],
      mode: "deterministic",
      reason: "incompatible",
    };
  const disabled = disabledReason(provider.config);
  if (disabled)
    return {
      assessment: baseline,
      signals: {},
      channels: [],
      mode: "deterministic",
      reason: disabled,
    };
  const vectors = await Promise.all(
    [lost, found].map(async (report) => {
      const text =
        typeof report.item.description === "string" &&
        knownText(report.item.description)
          ? `${report.item.name}\n${report.item.description}`.slice(0, 5000)
          : "";
      const safe = async (work: () => Promise<number[]>) => {
        try {
          return await work();
        } catch {
          return null;
        }
      };
      const [semantic, image] = await Promise.all([
        text
          ? safe(() =>
              provider.embed(
                report.item.id,
                report.revision,
                "text",
                async () => ({ text }),
              ),
            )
          : null,
        report.image && report.loadImage
          ? safe(() =>
              provider.embed(
                report.item.id,
                report.revision,
                "image:" + report.image.id,
                async () => ({
                  mimeType: "image/jpeg",
                  data: (await report.loadImage!()).toString("base64"),
                }),
              ),
            )
          : null,
      ]);
      return { semantic, image };
    }),
  );
  const [a, b] = vectors,
    signals: MatchingSignals = {},
    channels: string[] = [];
  const similarity = (x: number[], y: number[]) =>
    Math.max(0, cosineSimilarity(x, y));
  if (a.semantic && b.semantic) {
    signals.semanticSimilarity = similarity(a.semantic, b.semantic);
    channels.push("semantic");
  }
  if (a.image && b.image) {
    signals.imageSimilarity = similarity(a.image, b.image);
    channels.push("visual");
  } else if (a.image && b.semantic) {
    signals.imageSimilarity = similarity(a.image, b.semantic);
    channels.push("image-to-text");
  } else if (a.semantic && b.image) {
    signals.imageSimilarity = similarity(a.semantic, b.image);
    channels.push("image-to-text");
  }
  return {
    assessment: channels.length
      ? assessMatch(lost.item, found.item, signals)
      : baseline,
    signals,
    channels,
    mode: channels.length ? "gemini" : "deterministic",
    reason: channels.length ? "measured" : "unavailable-or-missing-input",
  };
}
