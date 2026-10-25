import "server-only";
import { createHash } from "node:crypto";
export interface AIConfig {
  enabled: boolean;
  demo: boolean;
  apiKey: string;
  model: string;
  dimensions: number;
  timeoutMs: number;
}
export function aiConfig(env: NodeJS.ProcessEnv = process.env): AIConfig {
  return {
    enabled: env.MAGPIE_AI_MATCHING_ENABLED === "true",
    demo: env.MAGPIE_AI_DEMO_MODE === "true",
    apiKey: env.GEMINI_API_KEY?.trim() || "",
    model: env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-2",
    dimensions: 768,
    timeoutMs: 5000,
  };
}
export function disabledReason(c: AIConfig) {
  return !c.enabled
    ? "disabled"
    : !c.demo
      ? "synthetic-demo-mode-required"
      : !c.apiKey
        ? "missing-api-key"
        : c.model !== "gemini-embedding-2"
          ? "unsupported-model"
          : null;
}
export function normalizedVector(value: unknown, dimensions: number): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== dimensions ||
    value.some((v) => typeof v !== "number" || !Number.isFinite(v))
  )
    throw Error("Invalid embedding");
  const norm = Math.hypot(...value);
  if (!Number.isFinite(norm) || norm < 1e-12)
    throw Error("Invalid embedding norm");
  return value.map((v) => v / norm);
}
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length)
    throw Error("Embedding dimension mismatch");
  const x = normalizedVector(a, a.length),
    y = normalizedVector(b, b.length);
  return Math.max(
    -1,
    Math.min(
      1,
      x.reduce((sum, v, i) => sum + v * y[i], 0),
    ),
  );
}
export async function bounded<T>(
  work: Promise<T>,
  ms: number,
  abort?: () => void,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          abort?.();
          reject(Error("AI timeout"));
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export interface EmbedClient {
  models: {
    embedContent: (
      args: any,
    ) => Promise<{ embeddings?: { values?: number[] }[] }>;
  };
}
export type EmbeddingInput =
  { text: string } | { mimeType: "image/jpeg"; data: string };
interface Entry {
  reportId: string;
  vector: number[];
  expires: number;
}
export class EmbeddingService {
  private cache = new Map<string, Entry>();
  private pending = new Map<string, Promise<number[]>>();
  private revisions = new Map<string, { revision: string; serial: number }>();
  private serial = 0;
  private active = 0;
  private waiters: {
    resolve: () => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }[] = [];
  constructor(
    public config: AIConfig,
    private clientFactory?: () => Promise<EmbedClient>,
    private now: () => number = Date.now,
  ) {}
  invalidate(reportId: string) {
    this.revisions.delete(reportId);
    for (const [key, entry] of this.cache)
      if (entry.reportId === reportId) this.cache.delete(key);
  }
  clear() {
    this.cache.clear();
    this.revisions.clear();
  }
  private async slot<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= 2) {
      if (this.waiters.length >= 6) throw Error("AI busy");
      await new Promise<void>((resolve, reject) => {
        const waiter = {
          resolve,
          reject,
          timer: setTimeout(() => {
            this.waiters = this.waiters.filter((w) => w !== waiter);
            reject(Error("AI busy"));
          }, this.config.timeoutMs),
        };
        this.waiters.push(waiter);
      });
    } else this.active++;
    try {
      return await work();
    } finally {
      const next = this.waiters.shift();
      if (next) {
        clearTimeout(next.timer);
        next.resolve();
      } else this.active--;
    }
  }
  async embed(
    reportId: string,
    revision: string,
    kind: string,
    prepare: () => Promise<EmbeddingInput>,
  ): Promise<number[]> {
    if (disabledReason(this.config)) throw Error("AI disabled");
    let stamp = this.revisions.get(reportId);
    if (!stamp || stamp.revision !== revision) {
      this.invalidate(reportId);
      stamp = { revision, serial: ++this.serial };
      this.revisions.set(reportId, stamp);
      while (this.revisions.size > 256)
        this.invalidate(this.revisions.keys().next().value!);
    }
    const key = createHash("sha256")
      .update(
        JSON.stringify([
          reportId,
          revision,
          kind,
          this.config.model,
          this.config.dimensions,
          stamp.serial,
        ]),
      )
      .digest("hex");
    const old = this.cache.get(key);
    if (old && old.expires > this.now()) {
      this.cache.delete(key);
      this.cache.set(key, old);
      return old.vector;
    }
    if (this.pending.has(key)) return this.pending.get(key)!;
    const task = this.slot(async () => {
      const input = await bounded(prepare(), this.config.timeoutMs);
      const client = this.clientFactory
        ? await this.clientFactory()
        : new (await import("@google/genai")).GoogleGenAI({
            apiKey: this.config.apiKey,
            httpOptions: {
              timeout: this.config.timeoutMs,
              retryOptions: { attempts: 1 },
            },
          });
      for (let attempt = 0; ; attempt++) {
        const controller = new AbortController();
        try {
          // One Content => one embedding. Never batch distinct reports as Parts.
          const parts =
            "text" in input
              ? [{ text: input.text }]
              : [
                  {
                    inlineData: { mimeType: input.mimeType, data: input.data },
                  },
                ];
          const response = await bounded(
            client.models.embedContent({
              model: this.config.model,
              contents: [{ parts }],
              config: {
                outputDimensionality: this.config.dimensions,
                abortSignal: controller.signal,
                httpOptions: {
                  timeout: this.config.timeoutMs,
                  retryOptions: { attempts: 1 },
                },
              },
            }),
            this.config.timeoutMs,
            () => controller.abort(),
          );
          if (response.embeddings?.length !== 1)
            throw Error("Invalid embedding count");
          const vector = normalizedVector(
            response.embeddings[0].values,
            this.config.dimensions,
          );
          if (this.revisions.get(reportId) === stamp) {
            this.cache.set(key, {
              reportId,
              vector,
              expires: this.now() + 600000,
            });
            while (this.cache.size > 128)
              this.cache.delete(this.cache.keys().next().value!);
          }
          return vector;
        } catch (error) {
          const status = Number((error as any)?.status);
          if (attempt >= 1 || ![429, 500, 502, 503, 504].includes(status))
            throw Error("Gemini inference unavailable");
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    });
    this.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.pending.delete(key);
    }
  }
}
let shared: EmbeddingService | undefined;
let fingerprint = "";
export function embeddings() {
  const c = aiConfig();
  const key = createHash("sha256").update(JSON.stringify(c)).digest("hex");
  if (!shared || key !== fingerprint) {
    shared = new EmbeddingService(c);
    fingerprint = key;
  }
  return shared;
}
export function invalidateAIReport(id: string) {
  shared?.invalidate(id);
}
