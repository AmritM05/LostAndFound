import { MIN_MATCH_SCORE } from "../matchVisibility";
import type { Query } from "./repository";
export function reportView(r: any, images: any[] = []) {
  return {
    id: r.id,
    reporterId: r.reporter_id,
    type: r.report_type,
    name: r.item_name,
    category: r.category,
    brand: r.brand,
    model: r.model,
    color: r.primary_color,
    secondaryColor: r.secondary_color,
    size: r.size,
    description: r.description,
    features: r.description,
    location: r.location_label,
    locationKnown: r.location_known,
    buildingId: r.building_id,
    lat: r.latitude,
    lng: r.longitude,
    date: new Date(r.occurred_at).toISOString(),
    status: r.status,
    image: "",
    imagePaths: images.filter((i) => i.report_id === r.id).map((i) => i.id),
    dropoffZoneId: r.dropoff_zone_id,
    custodyStatus: r.custody_status,
    receivedAt: r.received_at,
    foundAt: r.found_at,
    staffNotes: r.staff_notes,
    reporterEmail: r.email,
    reporterName: r.display_name,
    privateDetail: r.owner_description,
    identifyingDetails: {
      serialFragment: r.serial_fragment,
      stickers: r.stickers,
      scratches: r.scratches,
      contents: r.contents,
      uniqueMarkings: r.unique_markings,
    },
  };
}
export function adminRepository(query: Query) {
  return {
    async workspace() {
      const [
        reports,
        images,
        matches,
        claims,
        pickups,
        zones,
        activity,
        buildings,
        notes,
      ] = await Promise.all([
        query(
          "select r.*,u.email,u.display_name,d.owner_description,d.serial_fragment,d.stickers,d.scratches,d.contents,d.unique_markings from reports r join users u on u.id=r.reporter_id left join private_report_details d on d.report_id=r.id order by r.created_at desc",
        ),
        query(
          "select id,report_id from report_images where status='uploaded' and report_id is not null",
        ),
        query("select m.* from potential_matches m join reports l on l.id=m.lost_report_id join reports f on f.id=m.found_report_id where (not m.dismissed and m.score >= $1 and coalesce(to_jsonb(m)->'staff_reasoning'->>'eligible','true')='true' and l.status not in ('Returned','Archived','Ready for Pickup') and f.status not in ('Returned','Archived','Ready for Pickup')) or exists(select 1 from claims c where c.match_id=m.id) order by m.score desc,m.id", [MIN_MATCH_SCORE]),
        query(
          "select c.*,u.email,u.display_name from claims c join users u on u.id=c.claimant_id order by c.created_at desc",
        ),
        query(
          "select p.id,p.claim_id,p.display_code,p.expires_at,p.used_at,z.name as location from pickups p left join dropoff_zones z on z.id=p.zone_id order by p.created_at desc",
        ),
        query(
          "select z.*,b.name as building from dropoff_zones z left join buildings b on b.id=z.building_id order by z.name",
        ),
        query(
          "select a.*,u.display_name as staff_name from staff_activity a join users u on u.id=a.staff_id order by a.created_at desc limit 30",
        ),
        query(
          "select id,name,latitude,longitude from buildings where active order by name",
        ),
        query(
          "select id,report_id,body,from_staff,created_at from report_notes order by created_at",
        ),
      ]);
      return {
        reports: reports.map((r) => reportView(r, images)),
        matches,
        claims,
        pickups,
        zones,
        activity,
        buildings,
        notes,
      };
    },
    async saveFound(staff: string, data: any) {
      await query("select save_found_report($1,$2::jsonb,$3,$4::uuid[])", [
        staff,
        JSON.stringify(data.item),
        data.privateDetail,
        data.imageIds,
      ]);
    },
    async review(staff: string, data: any, code: string, hash: string) {
      await query("select review_ownership_claim($1,$2,$3,$4,$5,$6,$7)", [
        staff,
        data.id,
        data.status,
        data.zoneId || null,
        code,
        hash,
        data.message || "",
      ]);
    },
    async reissue(
      staff: string,
      pickupId: string,
      zoneId: string,
      code: string,
      hash: string,
    ) {
      await query("select reissue_expired_pickup($1,$2,$3,$4,$5)", [
        staff,
        pickupId,
        zoneId,
        code,
        hash,
      ]);
    },
    async redeem(staff: string, hash: string) {
      await query("select redeem_pickup($1,$2)", [staff, hash]);
    },
  };
}
