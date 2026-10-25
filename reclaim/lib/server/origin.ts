/** Central CSRF policy. Trust forwarded deployment hosts only on Vercel. */
export function allowedOrigin(request: Request, env = process.env): boolean {
  const supplied = request.headers.get("origin");
  if (!supplied || supplied === "null") return false;
  let origin: URL;
  try {
    origin = new URL(supplied);
  } catch {
    return false;
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.origin !== supplied
  )
    return false;
  const url = new URL(request.url);
  const allowed = new Set([url.origin]);
  for (const entry of (env.ALLOWED_ORIGINS || "").split(",")) {
    try {
      const u = new URL(entry.trim());
      if (["http:", "https:"].includes(u.protocol)) allowed.add(u.origin);
    } catch {}
  }
  for (const host of [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (host && /^[a-z0-9.-]+$/i.test(host)) allowed.add(`https://${host}`);
  }
  if (env.VERCEL === "1") {
    const host = request.headers.get("x-forwarded-host");
    const proto = request.headers.get("x-forwarded-proto");
    if (
      host &&
      /^[a-z0-9.-]+(?::\d+)?$/i.test(host) &&
      ["http", "https"].includes(proto || "")
    )
      allowed.add(`${proto}://${host}`);
  }
  if (env.NODE_ENV !== "production") {
    const local = (host: string) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(host);
    // Local aliases/ports are accepted only when the request itself targets loopback.
    if (
      (local(url.hostname) || url.hostname === "0.0.0.0") &&
      local(origin.hostname) &&
      origin.protocol === "http:"
    )
      return true;
  }
  return allowed.has(origin.origin);
}
