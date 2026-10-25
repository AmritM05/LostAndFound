import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../lib/server/http";
import { requireUser } from "../../../lib/server/session";
import { query } from "../../../lib/server/db";
import { uuid } from "../../../lib/server/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireUser(request),
      d = await body(request);
    if (
      !uuid(d.matchId) ||
      typeof d.answer !== "string" ||
      d.answer.trim().length < 10 ||
      d.answer.length > 1500
    )
      throw new ApiError("Provide ownership details");
    await query("select submit_ownership_claim($1,$2,$3)", [
      user.id,
      d.matchId,
      d.answer.trim(),
    ]);
    return json({ ok: true }, 201);
  }, request);
}
