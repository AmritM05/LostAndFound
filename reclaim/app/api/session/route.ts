import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../lib/server/http";
import {
  currentUser,
  startSession,
  endSession,
  cookie,
} from "../../../lib/server/session";
import { universityEmail } from "../../../lib/campus";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(async () => json({ user: await currentUser(request) }));
}
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const data = await body(request);
    const email =
      typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!universityEmail(email) || email.length > 254)
      throw new ApiError("Enter a valid permitted email address.");
    const name =
      typeof data.name === "string" ? data.name.trim().slice(0, 100) : "";
    const token = await startSession(email, name);
    const response = json({ ok: true });
    response.headers.set("Set-Cookie", cookie(token));
    return response;
  });
}
export async function DELETE(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    await endSession(request);
    const response = json({ ok: true });
    response.headers.set("Set-Cookie", cookie("", 0));
    return response;
  });
}
