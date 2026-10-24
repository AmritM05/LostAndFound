import { request, workspaceChanged } from "./apiClient";
import type { Profile } from "../lib/types";
export async function getProfile(): Promise<Profile | null> {
  return (await request<{ user: Profile | null }>("/api/session/")).user;
}
export async function signIn(email: string, name = "") {
  await request("/api/session/", {
    method: "POST",
    body: JSON.stringify({ email, name }),
  });
  workspaceChanged();
}
export async function signOut() {
  await request("/api/session/", { method: "DELETE" });
  workspaceChanged();
}
