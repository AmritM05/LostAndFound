// Explicitly opt-in, synthetic-only. Never selected by the default services test glob.
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { EmbeddingService, aiConfig } from "../lib/server/ai/embeddings";
import { compareWithGemini } from "../lib/server/ai/matching";
const enabled =
  process.env.MAGPIE_RUN_LIVE_GEMINI_TEST === "true" &&
  process.env.MAGPIE_AI_DEMO_MODE === "true" &&
  process.env.MAGPIE_AI_MATCHING_ENABLED === "true" &&
  !!process.env.GEMINI_API_KEY;
const item = (type: "lost" | "found", extra: any = {}) =>
  ({
    id: "synthetic-live-" + type,
    reporterId: "synthetic",
    type,
    name: "Backpack",
    category: "Backpack",
    brand: "Nike",
    model: "",
    color: "Black",
    description:
      type === "lost"
        ? "Nylon rucksack with two zippered pockets and a crimson carrying loop"
        : "Black travel backpack featuring a red fabric handle and twin zipped compartments",
    date: "2026-10-24T12:00:00Z",
    status: type === "lost" ? "Matching" : "Secured",
    lat: null,
    lng: null,
    ...extra,
  }) as any;
test(
  "opt-in real Gemini text/image/cross-modal synthetic inference and hard-filter check",
  { skip: !enabled, timeout: 60000 },
  async () => {
    const provider = new EmbeddingService(aiConfig());
    const report = (type: "lost" | "found", extra: any = {}) => ({
      item: item(type, extra),
      revision: "live-synthetic-v1",
    });
    const text = await compareWithGemini(
      report("lost"),
      report("found"),
      provider,
    );
    assert.equal(text.mode, "gemini");
    assert.ok(text.channels.includes("semantic"));
    assert.ok(Number.isFinite(text.signals.semanticSimilarity));
    const bytes = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#284e80" },
    })
      .jpeg()
      .toBuffer();
    const image = {
      ...report("lost", { description: "" }),
      image: { id: "generated-swatch" },
      loadImage: async () => bytes,
    };
    const cross = await compareWithGemini(image, report("found"), provider);
    assert.ok(cross.channels.includes("image-to-text"));
    const both = await compareWithGemini(
      image,
      {
        ...report("found", { description: "" }),
        image: { id: "generated-swatch" },
        loadImage: async () => bytes,
      },
      provider,
    );
    assert.ok(both.channels.includes("visual"));
    const rejected = await compareWithGemini(
      report("lost"),
      report("found", { brand: "Adidas" }),
      provider,
    );
    assert.equal(rejected.reason, "incompatible");
    const unknown = await compareWithGemini(
      report("lost", { brand: "" }),
      report("found"),
      provider,
    );
    assert.equal(unknown.assessment.eligible, true);
    console.log(
      JSON.stringify({
        provider: "google",
        model: provider.config.model,
        dimensions: 768,
        text: text.signals.semanticSimilarity,
        crossModal: cross.signals.imageSimilarity,
        visual: both.signals.imageSimilarity,
        semanticRankingImproved:
          text.assessment.score >
          (await import("../services/matchingService")).assessMatch(
            item("lost"),
            item("found"),
          ).score,
        contradictionRejected: true,
        unknownEligible: true,
      }),
    );
    // A swatch proves real image transport/embedding, not object-recognition quality.
  },
);
