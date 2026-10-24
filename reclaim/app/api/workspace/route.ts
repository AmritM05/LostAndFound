import { endpoint, json } from "../../../lib/server/http";
import { requireUser } from "../../../lib/server/session";
import { repository } from "../../../lib/server/repository";
import { query } from "../../../lib/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return endpoint(async () =>
    json(await repository(query).workspace(await requireUser(request))),
  );
}
