import "server-only";
import { assessMatch } from "../../../services/matchingService";
import type { Query } from "../repository";
import { reportView } from "../adminRepository";
import { ApiError } from "../http";
import {
  embeddings,
  disabledReason,
  type EmbeddingService,
} from "./embeddings";
import { authorizedImage, type AIImage } from "./images";
import { compareWithGemini, aiWeights, type AIReport } from "./matching";
import { uuid } from "../validation";
export function aiPairInput(data: any): { lostId: string; foundId: string } {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !uuid(data.lostId) ||
    !uuid(data.foundId) ||
    data.confirmSynthetic !== true ||
    Object.keys(data).some(
      (k) => !["lostId", "foundId", "confirmSynthetic"].includes(k),
    )
  )
    throw new ApiError(
      "Choose a lost/found pair and confirm synthetic-demo processing.",
    );
  return { lostId: data.lostId, foundId: data.foundId };
}
const running = new Set<string>();
export async function runAIMatching(
  staffId: string,
  lostId: string,
  foundId: string,
  query: Query,
  provider: EmbeddingService = embeddings(),
  loadImage = authorizedImage,
) {
  if (running.has(staffId) || running.size >= 2)
    throw new ApiError("AI comparison is busy. Try again shortly.", 429);
  running.add(staffId);
  try {
    const authorized = await query(
      "select id from users where id=$1 and role='admin'",
      [staffId],
    );
    if (!authorized.length) throw new ApiError("Staff access required.", 403);
    const rows = await query(
      "select r.*,ai_report_revision(r) as ai_revision from reports r where id=any($1::uuid[])",
      [[lostId, foundId]],
    );
    const lost = rows.find((r) => r.id === lostId && r.report_type === "lost"),
      found = rows.find((r) => r.id === foundId && r.report_type === "found");
    if (!lost || !found) {
      provider.invalidate(lostId);
      provider.invalidate(foundId);
      throw new ApiError("Reports unavailable.", 404);
    }
    const dismissed = await query(
      "select dismissed from potential_matches where lost_report_id=$1 and found_report_id=$2",
      [lostId, foundId],
    );
    if (dismissed[0]?.dismissed)
      return {
        mode: "deterministic",
        applied: false,
        reason: "dismissed",
        channels: [],
      };
    const active = await query(
      "select c.id from claims c join potential_matches m on m.id=c.match_id where c.status not in ('Rejected','Returned') and (m.lost_report_id=$1 or m.found_report_id=$2) limit 1",
      [lostId, foundId],
    );
    if (active.length)
      return {
        mode: "deterministic",
        applied: false,
        reason: "active-recovery",
        channels: [],
      };
    const wrap = (r: any): AIReport => ({
      item: reportView(r) as any,
      revision: r.ai_revision,
    });
    const l = wrap(lost),
      f = wrap(found);
    // Contradictions and environment consent gates are checked before image access.
    const baseline = assessMatch(l.item, f.item);
    if (!baseline.eligible)
      return {
        mode: "deterministic",
        applied: false,
        reason: "incompatible",
        channels: [],
        assessment: baseline,
      };
    if (!disabledReason(provider.config)) {
      const images = await query(
        "select id,report_id,owner_id,upload_role,status,mime_type,byte_size,blob_pathname,preview_pathname,preview_url from report_images where report_id=any($1::uuid[]) and status='uploaded' order by created_at,id",
        [[lostId, foundId]],
      );
      for (const report of [l, f]) {
        const image = images.find(
          (i: AIImage) => i.report_id === report.item.id,
        );
        if (image) {
          report.image = { id: image.id };
          report.loadImage = () =>
            loadImage(image, {
              id: report.item.id,
              reporterId: report.item.reporterId,
              type: report.item.type,
            });
        }
      }
    }
    const result = await compareWithGemini(l, f, provider);
    const [applied] = await query(
      "select apply_ai_match($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) as result",
      [
        staffId,
        lostId,
        foundId,
        l.revision,
        f.revision,
        JSON.stringify(result.signals),
        JSON.stringify({
          model: provider.config.model,
          dimensions: provider.config.dimensions,
          channels: result.channels,
          weights: aiWeights(process.env.MAGPIE_AI_MATCHING_WEIGHTS),
        }),
      ],
    );
    return {
      ...applied.result,
      mode: result.mode,
      channels: result.channels,
      providerReason: result.reason,
    };
  } finally {
    running.delete(staffId);
  }
}
