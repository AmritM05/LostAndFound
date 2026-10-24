import { endpoint, json } from "../../../lib/server/http";
import { repository } from "../../../lib/server/repository";
import { query } from "../../../lib/server/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return endpoint(async () => json(await repository(query).search()));
}
