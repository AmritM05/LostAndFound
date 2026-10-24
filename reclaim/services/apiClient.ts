export const WORKSPACE_CHANGE_EVENT = "magpie-workspace-change";
export function workspaceChanged() {
  window.dispatchEvent(new Event(WORKSPACE_CHANGE_EVENT));
}
export async function request<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error ||
        "Magpie could not complete this request. Please try again.",
    );
  return data;
}
