import { aiPairInput } from "../lib/server/ai/workflow";
import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  EmbeddingService,
  aiConfig,
  cosineSimilarity,
  normalizedVector,
  type AIConfig,
} from "../lib/server/ai/embeddings";
import { compareWithGemini, aiWeights } from "../lib/server/ai/matching";
import {
  assertImageAccess,
  imageToJpeg,
  authorizedImage,
} from "../lib/server/ai/images";
import { assessMatch } from "./matchingService";
import { measuredAI } from "../components/admin/StaffMatchAssessment";
import { POST } from "../app/api/admin/ai-matching/route";
const vector = (first = 1) =>
  Array.from({ length: 768 }, (_, i) => (i === 0 ? first : 0));
const config: AIConfig = {
  enabled: true,
  demo: true,
  apiKey: "synthetic-unit-test-key",
  model: "gemini-embedding-2",
  dimensions: 768,
  timeoutMs: 30,
};
const item = (type: "lost" | "found", extra: any = {}) =>
  ({
    id: type,
    reporterId: type === "lost" ? "student" : "staff",
    type,
    name: "Backpack",
    category: "Backpack",
    brand: "Nike",
    model: "",
    color: "Black",
    description:
      type === "lost"
        ? "A rucksack with a crimson loop"
        : "A bag with red fabric handle",
    date: "2026-10-24T12:00:00Z",
    status: type === "lost" ? "Matching" : "Secured",
    lat: null,
    lng: null,
    ...extra,
  }) as any;
const report = (type: "lost" | "found", extra: any = {}) => ({
  item: item(type, extra),
  revision: "v1",
});
const fake = (
  callback: (args: any) => any = () => ({ embeddings: [{ values: vector() }] }),
  c = config,
) =>
  new EmbeddingService(c, async () => ({
    models: { embedContent: async (args) => callback(args) },
  }));

test("official SDK-shaped request parses exactly one validated normalized 768-dimensional embedding", async () => {
  let args: any;
  const p = fake((a) => {
    args = a;
    return { embeddings: [{ values: vector(3) }] };
  });
  const v = await p.embed("report", "revision", "text", async () => ({
    text: "Synthetic backpack",
  }));
  assert.equal(v.length, 768);
  assert.equal(v[0], 1);
  assert.equal(args.model, "gemini-embedding-2");
  assert.equal(args.config.outputDimensionality, 768);
  assert.deepEqual(args.contents, [
    { parts: [{ text: "Synthetic backpack" }] },
  ]);
  assert.equal(args.config.taskType, undefined);
});
test("cosine handles directions and rejects zero norms, nonfinite values and dimension mismatch", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [-1, 0]), -1);
  for (const v of [
    [0, 0],
    [Infinity, 0],
    [NaN, 1],
  ])
    assert.throws(() => normalizedVector(v, 2));
  assert.throws(() => normalizedVector([1], 2));
  assert.throws(() => cosineSimilarity([1], [1, 0]));
});
test("disabled, missing-key and missing-demo gates use exact deterministic fallback without image or provider access", async () => {
  for (const c of [
    { ...config, enabled: false },
    { ...config, apiKey: "" },
    { ...config, demo: false },
    { ...config, model: "wrong-model" },
  ]) {
    let calls = 0;
    const p = fake(() => {
      calls++;
      throw Error("Must not call");
    }, c);
    const l = {
      ...report("lost"),
      image: { id: "photo" },
      loadImage: async () => {
        calls++;
        return Buffer.from("private");
      },
    };
    const result = await compareWithGemini(l, report("found"), p);
    assert.equal(result.mode, "deterministic");
    assert.equal(
      result.assessment.score,
      assessMatch(l.item, item("found")).score,
    );
    assert.equal(calls, 0);
  }
  assert.equal(aiConfig({} as any).enabled, false);
  assert.equal(aiConfig({ GEMINI_API_KEY: "key" } as any).demo, false);
});
test("hard brand/model/color contradictions precede all embedding and private image requests", async () => {
  for (const extra of [
    { brand: "Adidas" },
    { color: "bright yellow" },
    {
      name: "AirPods Pro",
      category: "Electronics",
      brand: "Samsung",
      model: "Galaxy Buds",
    },
  ]) {
    let calls = 0;
    const p = fake(() => {
      calls++;
      return { embeddings: [{ values: vector() }] };
    });
    const result = await compareWithGemini(
      {
        ...report("lost"),
        image: { id: "a" },
        loadImage: async () => {
          calls++;
          return Buffer.alloc(1);
        },
      },
      report("found", extra),
      p,
    );
    assert.equal(result.assessment.eligible, false);
    assert.equal(calls, 0);
  }
});
test("real-provider failure or malformed embedding falls back without invented AI scores or labels", async () => {
  for (const response of [
    { embeddings: [] },
    { embeddings: [{ values: [1, 2] }] },
    { embeddings: [{ values: vector(0) }] },
    { embeddings: [{ values: vector() }, { values: vector() }] },
    null,
  ]) {
    const p = fake(() => {
      if (response === null) throw Error("Synthetic provider failure");
      return response;
    });
    const result = await compareWithGemini(report("lost"), report("found"), p);
    assert.equal(result.mode, "deterministic");
    assert.deepEqual(result.signals, {});
    assert.equal(
      result.assessment.score,
      assessMatch(item("lost"), item("found")).score,
    );
  }
  assert.deepEqual(measuredAI({}), []);
  assert.deepEqual(measuredAI({ ai: { used: false, provider: "google" } }), []);
  assert.deepEqual(
    measuredAI({
      ai: {
        used: true,
        provider: "google",
        model: "gemini-embedding-2",
        dimensions: 768,
        channels: ["semantic", "not-real"],
      },
    }),
    ["semantic"],
  );
});
test("bounded timeout cancels the SDK request even if a mocked client never resolves", async () => {
  let signal: AbortSignal;
  const p = fake(
    (a) => {
      signal = a.config.abortSignal;
      return new Promise(() => {});
    },
    { ...config, timeoutMs: 10 },
  );
  await assert.rejects(
    p.embed("r", "v", "text", async () => ({ text: "Sample" })),
    /unavailable/,
  );
  assert.equal(signal!.aborted, true);
});
test("only transient provider status gets one retry; authentication errors are never retried", async () => {
  let n = 0;
  const p = fake(() => {
    if (++n === 1) throw Object.assign(Error("Transient"), { status: 503 });
    return { embeddings: [{ values: vector() }] };
  });
  await p.embed("r", "v", "text", async () => ({ text: "Sample" }));
  assert.equal(n, 2);
  n = 0;
  const bad = fake(() => {
    n++;
    throw Object.assign(Error("Denied"), { status: 403 });
  });
  await assert.rejects(
    bad.embed("r", "v", "text", async () => ({ text: "Sample" })),
  );
  assert.equal(n, 1);
});
test("cache deduplicates requests, invalidates changed/deleted reports and expires after its TTL", async () => {
  let calls = 0,
    now = 1;
  const p = new EmbeddingService(
    config,
    async () => ({
      models: {
        embedContent: async () => {
          calls++;
          return { embeddings: [{ values: vector() }] };
        },
      },
    }),
    () => now,
  );
  const run = (revision = "v1") =>
    p.embed("r", revision, "text", async () => ({ text: "Sample" }));
  await Promise.all([run(), run()]);
  assert.equal(calls, 1);
  await run();
  assert.equal(calls, 1);
  await run("v2");
  assert.equal(calls, 2);
  p.invalidate("r");
  await run("v2");
  assert.equal(calls, 3);
  now += 600001;
  await run("v2");
  assert.equal(calls, 4);
});
test("cache remains bounded and invalidation prevents in-flight responses from repopulating it", async () => {
  let calls = 0;
  let release: ((r: any) => void) | undefined;
  const p = fake(() => {
    calls++;
    if (calls === 1)
      return new Promise((r) => {
        release = r;
      });
    return { embeddings: [{ values: vector() }] };
  });
  const work = p.embed("r", "v", "text", async () => ({ text: "Sample" }));
  while (!release) await new Promise((r) => setTimeout(r, 0));
  p.invalidate("r");
  release({ embeddings: [{ values: vector() }] });
  await work;
  await p.embed("r", "v", "text", async () => ({ text: "Sample" }));
  assert.equal(calls, 2);
  for (let i = 0; i < 130; i++)
    await p.embed("r" + i, "v", "text", async () => ({ text: "Sample" }));
  const before = calls;
  await p.embed("r0", "v", "text", async () => ({ text: "Sample" }));
  assert.equal(calls, before + 1);
});
test("controlled concurrency never sends more than two provider requests at a time", async () => {
  let active = 0,
    maximum = 0;
  const p = fake(
    async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((r) => setTimeout(r, 2));
      active--;
      return { embeddings: [{ values: vector() }] };
    },
    { ...config, timeoutMs: 100 },
  );
  await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      p.embed("r" + i, "v", "text", async () => ({ text: "Sample" })),
    ),
  );
  assert.equal(maximum, 2);
});
test("missing photos/descriptions omit unavailable factors; image-to-text uses one shared model space", async () => {
  let calls = 0;
  const p = fake(() => {
    calls++;
    return { embeddings: [{ values: vector() }] };
  });
  let result = await compareWithGemini(
    report("lost", { description: "" }),
    report("found", { description: "" }),
    p,
  );
  assert.equal(calls, 0);
  assert.equal(result.mode, "deterministic");
  assert.equal(
    result.assessment.score,
    assessMatch(
      item("lost", { description: "" }),
      item("found", { description: "" }),
    ).score,
  );
  result = await compareWithGemini(
    {
      ...report("lost", { description: "", brand: "" }),
      image: { id: "p" },
      loadImage: async () => Buffer.from("synthetic JPEG fixture"),
    },
    report("found"),
    p,
  );
  assert.deepEqual(result.channels, ["image-to-text"]);
  assert.equal(result.signals.imageSimilarity, 1);
  assert.equal(result.assessment.eligible, true);
  const text = await compareWithGemini(report("lost"), report("found"), p);
  assert.deepEqual(text.channels, ["semantic"]);
});
test("prepared JPEGs resize/compress and discard metadata; HEIC conversion checks dimensions and disposes resources", async () => {
  const png = await sharp({
    create: { width: 1400, height: 1100, channels: 3, background: "#226699" },
  })
    .png()
    .toBuffer();
  const jpg = await imageToJpeg(png, "image/png");
  const metadata = await sharp(jpg).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.exif, undefined);
  let disposed = false;
  const decoder = {
    all: async () =>
      Object.assign(
        [
          {
            width: 2,
            height: 2,
            decode: async () => ({
              width: 2,
              height: 2,
              data: new Uint8ClampedArray(16).fill(255),
            }),
          },
        ],
        {
          dispose: () => {
            disposed = true;
          },
        },
      ),
  };
  assert.equal(
    (
      await sharp(
        await imageToJpeg(
          Buffer.from("synthetic decoder fixture"),
          "image/heic",
          decoder,
        ),
      ).metadata()
    ).format,
    "jpeg",
  );
  assert.equal(disposed, true);
  disposed = false;
  await assert.rejects(
    imageToJpeg(Buffer.from("synthetic fixture"), "image/heif", {
      all: async () =>
        Object.assign([{ width: 99999, height: 99999 }], {
          dispose: () => {
            disposed = true;
          },
        }),
    }),
  );
  assert.equal(disposed, true);
  await assert.rejects(
    imageToJpeg(Buffer.alloc(25 * 1024 * 1024 + 1), "image/jpeg"),
  );
  await assert.rejects(imageToJpeg(Buffer.from("bad"), "image/svg+xml"));
});
test("image access is tied to bound uploaded metadata and uses private preview/original paths only", async () => {
  const r = { id: "r", reporterId: "student", type: "lost" };
  const image = {
    id: "i",
    report_id: "r",
    owner_id: "student",
    upload_role: "student",
    status: "uploaded",
    mime_type: "image/png",
    byte_size: 12,
    blob_pathname: "private/original",
    preview_pathname: "private/preview",
    preview_url: "never-sent-to-Google",
  };
  for (const change of [
    { report_id: "foreign" },
    { owner_id: "other" },
    { upload_role: "admin" },
    { status: "pending" },
  ])
    assert.throws(() => assertImageAccess({ ...image, ...change }, r));
  let paths: string[] = [];
  const png = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#112233" },
  })
    .png()
    .toBuffer();
  await authorizedImage(image, r, async (path) => {
    paths.push(path);
    throw Error("Optional preview/read failure");
  }).catch(() => {});
  assert.deepEqual(paths, ["private/preview", "private/original"]);
  paths = [];
  await authorizedImage({ ...image, preview_url: null }, r, async (path) => {
    paths.push(path);
    return png;
  });
  assert.deepEqual(paths, ["private/original"]);
});
test("weights are allowlisted/configurable and malformed configuration keeps established defaults", () => {
  assert.equal(aiWeights('{"Image similarity":50}')["Image similarity"], 50);
  assert.equal(aiWeights('{"untrusted":99}')["Image similarity"], 30);
  assert.equal(aiWeights('{"Time":0}').Time, 10);
});
test("AI endpoint denies student cookies and foreign origins before any provider/private storage operation", async () => {
  const payload = {
    lostId: "11111111-1111-4111-8111-111111111111",
    foundId: "22222222-2222-4222-8222-222222222222",
    confirmSynthetic: true,
    imageUrl: "https://untrusted.example/private.jpg",
  };
  for (const origin of ["http://localhost:3000", "https://foreign.example"]) {
    const response = await POST(
      new Request("http://localhost:3000/api/admin/ai-matching/", {
        method: "POST",
        headers: { origin, cookie: "magpie_demo_session=" + "a".repeat(64) },
        body: JSON.stringify(payload),
      }),
    );
    assert.equal(
      response.status,
      origin === "http://localhost:3000" ? 401 : 403,
    );
  }
});

test("only an explicitly confirmed pair is accepted; clients cannot submit remote URLs, vectors or descriptions", () => {
  const pair = {
    lostId: "11111111-1111-4111-8111-111111111111",
    foundId: "22222222-2222-4222-8222-222222222222",
    confirmSynthetic: true,
  };
  assert.deepEqual(aiPairInput(pair), {
    lostId: pair.lostId,
    foundId: pair.foundId,
  });
  for (const extra of [
    { imageUrl: "https://untrusted.example/photo" },
    { description: "private" },
    { embedding: [1, 2] },
    { confirmSynthetic: false },
    { lostId: "invalid" },
  ])
    assert.throws(() => aiPairInput({ ...pair, ...extra }));
});
