import { endpoint, json, body, sameOrigin } from "../../../lib/server/http";
import { requireUser } from "../../../lib/server/session";
import { repository } from "../../../lib/server/repository";
import { query } from "../../../lib/server/db";
import { reportInput } from "../../../lib/server/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireUser(request);
    const data = reportInput(await body(request));
    await repository(query).save(
      user,
      data.item,
      data.privateDetail,
      data.imageIds,
    );
    return json({ id: data.item.id }, 201);
  });
}
