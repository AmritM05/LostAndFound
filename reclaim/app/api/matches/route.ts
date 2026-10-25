import { findOwnedPotentialMatch } from "../../../lib/server/matchCandidates";
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
    const m = await findOwnedPotentialMatch(query, d.lostId, d.foundId, u.id);
    if (!m)
      throw new ApiError(
        "No compatible match was found. Staff will review new reports as they arrive.",
        404,
      );
    return json(m);
  }, request);
}
