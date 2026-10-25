import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { query } from "./db";
import { ApiError } from "./http";
import type { Profile } from "../types";
export const adminCookie = "magpie_admin_session";
export const tokenHash = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function adminSessionCookie(token: string, age = 28800) {
  return `${adminCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
function token(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(adminCookie + "="))
    ?.slice(adminCookie.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function currentAdmin(request: Request): Promise<Profile | null> {
  const value = token(request);
  if (!value) return null;
  const [u] = await query(
    "select u.id,u.email,u.display_name as name from admin_sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now() and u.role='admin'",
    [tokenHash(value)],
  );
  return u ? ({ ...u, role: "admin", verified: true } as Profile) : null;
}
export async function requireAdmin(request: Request) {
  const u = await currentAdmin(request);
  if (!u) throw new ApiError("Staff sign-in required.", 401);
  return u;
}
export function validAdminCredentials(email: unknown, password: unknown) {
  const expectedEmail = process.env.ADMIN_DEMO_EMAIL?.trim().toLowerCase(),
    expectedPassword = process.env.ADMIN_DEMO_PASSWORD;
  // Fixed-length digest comparison, including incorrect emails.
  return (
    !!expectedEmail &&
    !!expectedPassword &&
    typeof email === "string" &&
    typeof password === "string" &&
    timingSafeEqual(
      Buffer.from(
        tokenHash(email.trim().toLowerCase() + "\0" + password),
        "hex",
      ),
      Buffer.from(tokenHash(expectedEmail + "\0" + expectedPassword), "hex"),
    )
  );
}
const loginWindows = new Map<string, { count: number; until: number }>();
export async function startAdmin(email: unknown, password: unknown) {
  if (!process.env.ADMIN_DEMO_EMAIL || !process.env.ADMIN_DEMO_PASSWORD)
    throw new ApiError(
      "Staff sign-in is not configured. Ask the demo organizer to configure admin credentials.",
      503,
    );
  const key = tokenHash(String(email).trim().toLowerCase());
  const now = Date.now(),
    existing = loginWindows.get(key);
  const window =
    existing && existing.until > now
      ? existing
      : { count: 0, until: now + 15 * 60000 };
  window.count++;
  loginWindows.set(key, window);
  if (loginWindows.size > 1000)
    for (const [k, v] of loginWindows) {
      if (v.until <= now) loginWindows.delete(k);
    }
  if (loginWindows.size > 2000 || window.count > 10)
    throw new ApiError(
      "Too many sign-in attempts. Please try again in 15 minutes.",
      429,
    );
  if (!validAdminCredentials(email, password))
    throw new ApiError("Invalid admin credentials.", 401);
  const [attempt] = await query(
    "insert into admin_login_attempts(key_hash) values($1) on conflict(key_hash) do update set attempts=case when admin_login_attempts.window_start<now()-interval '15 minutes' then 1 else admin_login_attempts.attempts+1 end,window_start=case when admin_login_attempts.window_start<now()-interval '15 minutes' then now() else admin_login_attempts.window_start end returning attempts",
    [key],
  );
  if (attempt.attempts > 10)
    throw new ApiError(
      "Too many sign-in attempts. Please try again in 15 minutes.",
      429,
    );

  const [{ id }] = await query(
    "insert into users(email,display_name,role) values($1,'Campus staff','admin') on conflict(email) do update set role='admin' returning id",
    [process.env.ADMIN_DEMO_EMAIL!.trim().toLowerCase()],
  );
  const value = randomBytes(32).toString("hex");
  await query(
    "insert into admin_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '8 hours')",
    [tokenHash(value), id],
  );
  await query("delete from admin_login_attempts where key_hash=$1", [key]);
  return value;
}
export async function endAdmin(request: Request) {
  const value = token(request);
  if (value)
    await query("delete from admin_sessions where token_hash=$1", [
      tokenHash(value),
    ]);
}
