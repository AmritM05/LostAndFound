import type {
  AppState,
  Claim,
  DropoffZone,
  Item,
  Profile,
  PublicReport,
} from "../lib/types";
import { request, workspaceChanged } from "./apiClient";
import { uploadReportImages } from "./storageService";
export { getProfile } from "./sessionService";
export interface Correspondence {
  id: string;
  reportId: string;
  body: string;
  fromStaff: boolean;
  createdAt: string;
}
export async function loadWorkspace(
  _user: Profile,
): Promise<{ state: AppState; messages: Correspondence[] }> {
  return request("/api/workspace/");
}
export async function searchPublicReports(): Promise<PublicReport[]> {
  return request("/api/search/");
}
export async function createReport(
  item: Item,
  privateDetail: string,
  files: File[],
  onProgress?: (percent: number) => void,
) {
  const imageIds = await uploadReportImages(files, onProgress);
  await request("/api/reports/", {
    method: "POST",
    body: JSON.stringify({ item, privateDetail, imageIds }),
  });
  workspaceChanged();
}
export async function editLostReport(item: Item, privateDetail: string) {
  await request(`/api/reports/${item.id}/`, {
    method: "PATCH",
    body: JSON.stringify({ item, privateDetail, imageIds: [] }),
  });
  workspaceChanged();
}
export async function markUpdatesRead() {
  await request("/api/updates/", { method: "PATCH" });
  workspaceChanged();
}
export async function sendMessage(reportId: string, body: string) {
  await request("/api/notes/", {
    method: "POST",
    body: JSON.stringify({ reportId, body }),
  });
  workspaceChanged();
}
export async function listDropoffZones(): Promise<DropoffZone[]> {
  return [];
}
function unavailable(): never {
  throw new Error("This staff workflow is not available yet.");
}
export async function updateReportStatus(_id: string, _status: Item["status"]) {
  unavailable();
}
export async function dismissMatch(_id: string) {
  unavailable();
}
export async function saveDropoffZone(_zone: DropoffZone) {
  unavailable();
}
export async function submitClaim(_matchId: string, _answer: string) {
  unavailable();
}
export async function reviewClaim(
  _claimId: string,
  _status: Claim["status"],
  _pickupLocation: string,
  _message: string,
) {
  unavailable();
}
export async function confirmPickup(_code: string) {
  unavailable();
}
export async function updateCustody(_id: string, _status: string) {
  unavailable();
}
export interface MatchResult {
  id: string;
  lostId: string;
  foundId: string;
  score: number;
  factors: Record<string, number>;
  distance: number | null;
  minutes: number;
}
export async function connectSearchReport(
  _foundId: string,
  _lostId: string,
): Promise<MatchResult> {
  return unavailable();
}

export async function deleteReport(id: string) {
  const result = await request(`/api/reports/${encodeURIComponent(id)}/`, {
    method: "DELETE",
  });
  workspaceChanged();
  return result;
}
