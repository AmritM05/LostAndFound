import { endpoint, json } from "../../../../lib/server/http";
import { requireAdmin } from "../../../../lib/server/adminSession";
import { query } from "../../../../lib/server/db";
import { adminRepository } from "../../../../lib/server/adminRepository";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return endpoint(async () => {
    await requireAdmin(request);
    return json(await adminRepository(query).workspace());
  }, request);
}
