import "server-only";
import { allowedOrigin } from "./origin";
import { diagnostic, classifyFailure } from "./diagnostics";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function endpoint(
  action: () => Promise<Response>,
  request?: Request,
) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    const code = (error as { code?: string }).code;
    if (code === "P0001") {
      const message = (error as Error).message;
      const allowed = [
        "Select an active drop-off zone",
        "Invalid found report",
        "Choose valid found and received times",
        "Match unavailable",
        "Provide ownership details",
        "Claim already submitted",
        "Claim not found",
        "Claim cannot be changed",
        "Provide a private information request",
        "Item already assigned",
        "Pickup code is invalid or expired",
        "Students may only create lost reports",
        "Item name and category are required",
        "Choose a valid past date",
        "Select an active campus building",
        "Choose valid coordinates or location unknown",
        "Report not found",
        "This report has an active claim",
        "This report cannot be deleted while an active recovery is in progress.",
        "Report ID unavailable",
        "Choose up to three unique images",
        "Image upload is incomplete or unavailable",
      ];
      if (allowed.includes(message))
        return json(
          { error: message },
          message === "Report not found"
            ? 404
            : message ===
                "This report cannot be deleted while an active recovery is in progress."
              ? 409
              : 400,
        );
    }
    const failure = classifyFailure(error);
    diagnostic(error, {
      route: request ? new URL(request.url).pathname : "unknown",
      action: request?.method || "unknown",
      status: 503,
      operation: failure.operation,
    });
    return json({ error: failure.message }, 503);
  }
}
export function sameOrigin(request: Request) {
  if (!allowedOrigin(request)) {
    if (process.env.NODE_ENV !== "production") {
      let origin = "missing or invalid";
      try {
        origin = new URL(request.headers.get("origin") || "").origin;
      } catch {}
      console.warn("[Magpie origin]", {
        route: new URL(request.url).pathname,
        requestOrigin: new URL(request.url).origin,
        origin,
        host: request.headers.get("host"),
        forwardedHost: request.headers.get("x-forwarded-host"),
      });
    }
    throw new ApiError("Request origin is not allowed.", 403);
  }
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length")) > 100000)
    throw new ApiError("Request is too large.", 413);
  const text = await request.text();
  if (text.length > 100000) throw new ApiError("Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("Invalid request.");
  }
}
