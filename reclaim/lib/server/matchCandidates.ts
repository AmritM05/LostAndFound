import { MIN_MATCH_SCORE } from "../matchVisibility";
import type { Query } from "./repository";

// Student-safe direct-match projection. Private staff reasoning is filter-only.
export async function findOwnedPotentialMatch(query: Query, lostId: string, foundId: string, ownerId: string) {
  const [match] = await query(
    `select m.id,m.lost_report_id as "lostId",m.found_report_id as "foundId",m.score,m.factors,m.distance_km as distance,m.minutes_difference as minutes
     from potential_matches m join reports l on l.id=m.lost_report_id join reports f on f.id=m.found_report_id
     where l.id=$1 and f.id=$2 and l.reporter_id=$3 and not m.dismissed and m.score >= $4
     and coalesce(to_jsonb(m)->'staff_reasoning'->>'eligible','true')='true'
     and l.status not in ('Returned','Archived','Ready for Pickup') and f.status not in ('Returned','Archived','Ready for Pickup')`,
    [lostId, foundId, ownerId, MIN_MATCH_SCORE],
  );
  return match;
}
