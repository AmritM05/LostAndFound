import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../../lib/server/http";
import {
  currentAdmin,
  startAdmin,
  endAdmin,
  adminSessionCookie,
} from "../../../../lib/server/adminSession";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return endpoint(
    async () => json({ user: await currentAdmin(request) }),
    request,
  );
}
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const data = await body(request);
    if (
      typeof data.email !== "string" ||
      typeof data.password !== "string" ||
      data.email.length > 254 ||
      data.password.length > 1000
    )
      throw new ApiError("Invalid admin credentials.", 401);
    const token = await startAdmin(data.email, data.password);
    const r = json({ ok: true });
    r.headers.set("Set-Cookie", adminSessionCookie(token));
    return r;
  }, request);
}
export async function DELETE(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await endAdmin(request);
    const r = json({ ok: true });
    r.headers.set("Set-Cookie", adminSessionCookie("", 0));
    return r;
  }, request);
}
