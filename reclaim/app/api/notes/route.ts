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
      data = await body(request);
    if (
      !uuid(data.reportId) ||
      typeof data.body !== "string" ||
      !data.body.trim() ||
      data.body.length > 2000
    )
      throw new ApiError("Add a note under 2,000 characters.");
    const rows = await query(
      "insert into report_notes(report_id,sender_id,body) select id,$1,$3 from reports where id=$2 and reporter_id=$1 and report_type='lost' returning id",
      [user.id, data.reportId, data.body.trim()],
    );
    if (!rows.length) throw new ApiError("Report not found.", 404);
    return json({ ok: true });
  });
}
