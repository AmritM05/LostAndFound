import { campus } from "../../../lib/campus";
import { query } from "../../../lib/server/db";
import { requireUser } from "../../../lib/server/session";
import { studentDropoffEndpoint } from "../../../lib/server/studentDropoffs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = studentDropoffEndpoint({
  requireStudent: requireUser,
  query,
  campusId: campus.id,
});
