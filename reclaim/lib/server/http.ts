import "server-only";
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
export async function endpoint(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ApiError)
      return json({ error: error.message }, error.status);
    const code = (error as { code?: string }).code;
    if (code === "P0001") {
      const message = (error as Error).message;
      const allowed = [
        "Students may only create lost reports",
        "Item name and category are required",
        "Choose a valid past date",
        "Select an active campus building",
        "Choose valid coordinates or location unknown",
        "Report not found",
        "This report has an active claim",
        "Report ID unavailable",
        "Choose up to three unique images",
        "Image upload is incomplete or unavailable",
      ];
      if (allowed.includes(message))
        return json(
          { error: message },
          message === "Report not found" ? 404 : 400,
        );
    }
    console.error("[Magpie API] Request failed", {
      name: (error as Error).name,
      code,
      configurationMissing: !process.env.DATABASE_URL,
      blobConfigurationMissing: !process.env.BLOB_READ_WRITE_TOKEN,
    });
    return json(
      {
        error:
          "Magpie could not complete this request. Please try again. If it continues, check the server setup.",
      },
      503,
    );
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new ApiError("Request origin is not allowed.", 403);
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
