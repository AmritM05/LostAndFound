import "server-only";
export class ServiceFailure extends Error {
  constructor(
    public operation: string,
    public reason: "configuration" | "connection" | "schema",
    public safeMessage: string,
    public code?: string,
  ) {
    super(safeMessage);
  }
}
export function classifyFailure(error: unknown) {
  if (error instanceof ServiceFailure)
    return { operation: error.operation, message: error.safeMessage };
  return {
    operation: "server",
    message:
      "This service is temporarily unavailable. Please try again shortly.",
  };
}
export function diagnostic(
  error: unknown,
  context: { route: string; action: string; status: number; operation: string },
) {
  // Never serialize exception messages/causes: provider errors can embed connection URLs or item data.
  const e = error as any;
  console.error("[Magpie API]", {
    ...context,
    name: e?.name || "Error",
    code: /^[A-Z0-9_]{1,32}$/.test(e?.code || "") ? e.code : undefined,
    message:
      error instanceof ServiceFailure
        ? error.safeMessage
        : "Provider or server operation failed",
    reason: error instanceof ServiceFailure ? error.reason : undefined,
  });
}
