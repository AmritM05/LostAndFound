import type { Item, Profile, PublicReport } from "../types";
export type Query = (sql: string, values?: any[]) => Promise<any[]>;
export function repository(query: Query) {
  return {
    async workspace(user: Profile) {
      const [reports, images, details, updates, matches, claims, messages] =
        await Promise.all([
          query(
            "select *,has_active_recovery(id) as deletion_blocked from reports where reporter_id=$1 and report_type='lost' order by created_at desc",
            [user.id],
          ),
          query(
            "select id,report_id from report_images where owner_id=$1 and report_id is not null and status='uploaded' order by created_at",
            [user.id],
          ),
          query(
            "select d.report_id,d.owner_description from private_report_details d join reports r on r.id=d.report_id where r.reporter_id=$1 and r.report_type='lost'",
            [user.id],
          ),
          query(
            "select * from updates where user_id=$1 order by created_at desc",
            [user.id],
          ),
          query(
            "select m.* from potential_matches m join reports r on r.id=m.lost_report_id where r.reporter_id=$1",
            [user.id],
          ),
          query("select * from claims where claimant_id=$1", [user.id]),
          query(
            "select n.* from report_notes n join reports r on r.id=n.report_id where r.reporter_id=$1 order by n.created_at",
            [user.id],
          ),
        ]);
      return {
        state: {
          items: reports.map((r) => ({
            id: r.id,
            deletionBlocked: !!r.deletion_blocked,
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
            imagePaths: images
              .filter((i) => i.report_id === r.id)
              .map((i) => i.id),
          })),
          privateDetails: Object.fromEntries(
            details.map((d) => [d.report_id, d.owner_description]),
          ),
          notices: updates.map((u) => ({
            id: u.id,
            title: u.title,
            message: u.message,
            read: u.read,
            reportId: u.report_id,
            matchId: u.match_id,
            createdAt: u.created_at,
          })),
          matches: matches.map((m) => ({
            id: m.id,
            lostId: m.lost_report_id,
            foundId: m.found_report_id,
            score: m.score,
            factors: m.factors,
            distance: m.distance_km,
            minutes: m.minutes_difference,
            dismissed: m.dismissed,
          })),
          claims: claims.map((c) => ({
            id: c.id,
            matchId: c.match_id,
            claimantId: c.claimant_id,
            answers: c.answers,
            status: c.status,
            score: 0,
          })),
        },
        messages: messages.map((n) => ({
          id: n.id,
          reportId: n.report_id,
          body: n.body,
          fromStaff: n.from_staff,
          createdAt: n.created_at,
        })),
      };
    },
    async save(
      user: Profile,
      item: Item,
      privateDetail: string,
      imageIds: string[],
      edit = false,
    ) {
      await query("select save_student_report($1,$2::jsonb,$3,$4::uuid[],$5)", [
        user.id,
        JSON.stringify(item),
        privateDetail,
        imageIds,
        edit,
      ]);
    },
    async deleteReport(user: Profile, id: string) {
      const [row] = await query(
        "select delete_own_lost_report($1,$2) as deleted",
        [user.id, id],
      );
      return !!row?.deleted;
    },
    async search(): Promise<PublicReport[]> {
      return await query(
        "select id,type,category,location,date,status from public_found_summaries order by date desc limit 200",
      );
    },
  };
}
