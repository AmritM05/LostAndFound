import { endpoint, json, sameOrigin } from "../../../lib/server/http";
import { requireUser } from "../../../lib/server/session";
import { query } from "../../../lib/server/db";
export const runtime = "nodejs";
export async function PATCH(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireUser(request);
    await query("update updates set read=true where user_id=$1", [user.id]);
    return json({ ok: true });
  }, request);
}
