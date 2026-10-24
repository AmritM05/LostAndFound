import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { query } from "./db";
import { ApiError } from "./http";
import type { Profile } from "../types";
export const sessionCookie = "magpie_demo_session";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function cookie(value: string, maxAge = 604800) {
  return `${sessionCookie}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
function token(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(sessionCookie + "="))
    ?.slice(sessionCookie.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function currentUser(request: Request): Promise<Profile | null> {
  const value = token(request);
  if (!value) return null;
  const [user] = await query(
    "select u.id,u.email,u.display_name as name from demo_sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()",
    [hash(value)],
  );
  // Email-only sessions NEVER grant staff privileges, even for a manually assigned admin user.
  return user
    ? ({ ...user, role: "student", verified: false } as Profile)
    : null;
}
export async function requireUser(request: Request) {
  const user = await currentUser(request);
  if (!user) throw new ApiError("Sign in to continue.", 401);
  return user;
}
export async function startSession(email: string, name: string) {
  const [{ id }] = await query(
    "insert into users(email,display_name) values($1,$2) on conflict(email) do update set display_name=case when $3 then excluded.display_name else users.display_name end returning id",
    [email, name || email.split("@")[0], !!name],
  );
  const value = randomBytes(32).toString("hex");
  await query(
    "insert into demo_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '7 days')",
    [hash(value), id],
  );
  return value;
}
export async function endSession(request: Request) {
  const value = token(request);
  if (value)
    await query("delete from demo_sessions where token_hash=$1", [hash(value)]);
}
