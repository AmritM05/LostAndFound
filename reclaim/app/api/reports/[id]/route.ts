import { cleanupReportPhotos } from "../../../../lib/server/blobCleanup";
import {
  endpoint,
  json,
  body,
  sameOrigin,
  ApiError,
} from "../../../../lib/server/http";
import { requireUser } from "../../../../lib/server/session";
import { repository } from "../../../../lib/server/repository";
import { query } from "../../../../lib/server/db";
import { reportInput, uuid } from "../../../../lib/server/validation";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireUser(request),
      { id } = await params;
    if (!uuid(id)) throw new ApiError("Report not found.", 404);
    const data = reportInput(await body(request), id);
    await repository(query).save(user, data.item, data.privateDetail, [], true);
    return json({ ok: true });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    sameOrigin(request);
    const user = await requireUser(request),
      { id } = await params;
    if (!uuid(id)) throw new ApiError("Report not found.", 404);
    if (!(await repository(query).deleteReport(user, id)))
      throw new ApiError("Report not found.", 404);
    const { pending } = await cleanupReportPhotos(id, user.id);
    return json({ deleted: true, cleanupPending: pending > 0 });
  });
}
