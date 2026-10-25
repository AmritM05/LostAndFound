import type { Claim, AppState } from "../../lib/types";
import type { Correspondence } from "../../services/workspaceService";

export function claimContext(state: AppState, claim: Claim) {
  const match = state.matches.find((m) => m.id === claim.matchId);
  return match && state.items.find((i) => i.id === match.lostId);
}
export function reportCorrespondence(
  messages: Correspondence[],
  reportId: string,
) {
  return messages
    .filter((m) => m.reportId === reportId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export function validateResponse(answer: string) {
  if (answer.trim().length < 10)
    return "Provide at least 10 characters of ownership evidence.";
  if (answer.length > 1500)
    return "Keep your response within 1,500 characters.";
  return "";
}
export function claimStatusText(claim: Claim) {
  switch (claim.status) {
    case "More information":
      return "Action needed: campus staff need more ownership evidence. Submit your response below.";
    case "Pending":
      return "Your ownership information has been received and is awaiting staff review.";
    case "Approved":
      return claim.code
        ? "Your claim is approved. Keep your pickup pass private and follow the campus pickup instructions."
        : "Your claim is approved, but no current pickup pass is available. Contact campus staff before travelling to collect the item.";
    case "Rejected":
      return "Your claim was not approved. Contact campus staff if you have additional evidence.";
    case "Returned":
      return "Pickup is complete. This claim is closed.";
  }
}
