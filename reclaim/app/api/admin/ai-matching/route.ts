import { endpoint, json, body, sameOrigin } from "../../../../lib/server/http";
import { requireAdmin } from "../../../../lib/server/adminSession";
import { query } from "../../../../lib/server/db";
import { runAIMatching, aiPairInput } from "../../../../lib/server/ai/workflow";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const staff = await requireAdmin(request);
    const data = aiPairInput(await body(request));
    return json(
      await runAIMatching(staff.id, data.lostId, data.foundId, query),
    );
  }, request);
}
