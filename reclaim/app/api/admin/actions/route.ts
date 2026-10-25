import { randomBytes } from "node:crypto";
import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../../lib/server/http";
import { requireAdmin, tokenHash } from "../../../../lib/server/adminSession";
import { query } from "../../../../lib/server/db";
import { adminRepository } from "../../../../lib/server/adminRepository";
import { uuid } from "../../../../lib/server/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireAdmin(request),
      data = await body(request);
    const repo = adminRepository(query);
    switch (data.action) {
      case "reviewClaim": {
        if (
          !uuid(data.id) ||
          !["Approved", "Rejected", "More information"].includes(data.status) ||
          (data.status === "Approved" && !uuid(data.zoneId)) ||
          typeof data.message !== "string" ||
          data.message.length > 2000 ||
          (data.status === "More information" && !data.message.trim())
        )
          throw new ApiError("Choose a valid claim decision and pickup zone.");
        const code = randomBytes(6).toString("hex").toUpperCase();
        await repo.review(user.id, data, code, tokenHash(code));
        break;
      }
      case "pickup": {
        if (
          typeof data.code !== "string" ||
          !/^([a-f0-9]{12})$/i.test(data.code.trim())
        )
          throw new ApiError("Pickup code is invalid or expired");
        await repo.redeem(user.id, tokenHash(data.code.trim().toUpperCase()));
        break;
      }
      case "dismissMatch": {
        if (!uuid(data.id)) throw new ApiError("Match unavailable");
        // Lock reports before match, matching claim/deletion lock order.
        const rows = await query(
          `with locked as materialized (select r.id from reports r join potential_matches m on r.id in(m.lost_report_id,m.found_report_id) where m.id=$1 order by r.report_type desc for update of r), dismissed as (update potential_matches set dismissed=true where id=$1 and (select count(*) from locked)=2 and not exists(select 1 from claims where match_id=$1 and status not in ('Rejected','Returned')) returning found_report_id) insert into staff_activity(staff_id,report_id,action) select $2,found_report_id,'Dismissed match' from dismissed returning id`,
          [data.id, user.id],
        );
        if (!rows.length)
          throw new ApiError(
            "Match has an active claim or is unavailable.",
            409,
          );
        break;
      }
      case "custody": {
        if (
          !uuid(data.id) ||
          !["Received", "Stored", "Potential Match", "Claim Pending"].includes(
            data.status,
          )
        )
          throw new ApiError("Choose a valid custody status.");
        const rows = await query(
          `with changed as (update reports set custody_status=$2,updated_at=now() where id=$1 and report_type='found' and status not in ('Ready for Pickup','Returned','Archived') and not has_active_recovery(id) returning id) insert into staff_activity(staff_id,report_id,action) select $3,id,'Custody: '||$2 from changed returning id`,
          [data.id, data.status, user.id],
        );
        if (!rows.length)
          throw new ApiError(
            "This item has an active recovery or is unavailable.",
            409,
          );
        break;
      }
      default:
        throw new ApiError("Choose a valid staff action.");
    }
    return json({ ok: true });
  }, request);
}
