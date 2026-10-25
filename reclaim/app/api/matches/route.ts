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
export async function PATCH(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const u = await requireUser(request),
      d = await body(request);
    if (!uuid(d.id)) throw new ApiError("Match unavailable");
    const rows = await query(
      "update potential_matches m set dismissed=true from reports r where m.id=$1 and r.id=m.lost_report_id and r.reporter_id=$2 and not exists(select 1 from claims where match_id=m.id and status not in ('Rejected','Returned')) returning m.id",
      [d.id, u.id],
    );
    if (!rows.length) throw new ApiError("Match unavailable");
    return json({ ok: true });
  }, request);
}
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const u = await requireUser(request),
      d = await body(request);
    if (!uuid(d.foundId) || !uuid(d.lostId))
      throw new ApiError("Match unavailable");
    const [m] = await query(
      "select m.id,m.lost_report_id as \"lostId\",m.found_report_id as \"foundId\",m.score,m.factors,m.distance_km as distance,m.minutes_difference as minutes from potential_matches m join reports l on l.id=m.lost_report_id join reports f on f.id=m.found_report_id where l.id=$1 and f.id=$2 and l.reporter_id=$3 and not m.dismissed and l.status not in ('Returned','Archived') and f.status not in ('Returned','Archived')",
      [d.lostId, d.foundId, u.id],
    );
    if (!m)
      throw new ApiError(
        "No compatible match was found. Staff will review new reports as they arrive.",
        404,
      );
    return json(m);
  }, request);
}
