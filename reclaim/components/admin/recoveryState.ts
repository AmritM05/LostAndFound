// Admin-only presentation. Database guards remain authoritative for every action.
export interface RecoveryPickup {
  id: string;
  claim_id: string;
  expires_at?: string | null;
  used_at?: string | null;
  display_code?: string | null;
  location?: string;
}
export interface RecoveryClaim {
  id: string;
  match_id: string;
  status: string;
}
export interface RecoveryMatch {
  id: string;
  lost_report_id: string;
  found_report_id: string;
  dismissed?: boolean;
}
export interface RecoveryReport {
  id: string;
  status: string;
  name?: string;
}
export function claimReviewable(
  claim: RecoveryClaim,
  match: RecoveryMatch | undefined,
  reports: RecoveryReport[],
) {
  return (
    ["Pending", "More information"].includes(claim.status) &&
    !!match &&
    !match.dismissed &&
    [match.lost_report_id, match.found_report_id].every((id) => {
      const report = reports.find((r) => r.id === id);
      return (
        !!report &&
        !["Returned", "Archived", "Ready for Pickup"].includes(report.status)
      );
    })
  );
}
export function pickupState(
  pickup: RecoveryPickup,
  claim: RecoveryClaim | undefined,
  match: RecoveryMatch | undefined,
  reports: RecoveryReport[],
  now = Date.now(),
) {
  // Physical completion always wins over a later deadline check.
  if (pickup.used_at) return "Returned";
  const pair =
    match &&
    [match.lost_report_id, match.found_report_id].map((id) =>
      reports.find((r) => r.id === id),
    );
  if (
    claim?.status === "Returned" ||
    pair?.some((r) => r && ["Returned", "Archived"].includes(r.status))
  )
    return "Closed";
  if (
    !claim ||
    claim.status !== "Approved" ||
    !match ||
    match.dismissed ||
    !pair?.every((r) => r?.status === "Ready for Pickup")
  )
    return "Needs review";
  const deadline = pickup.expires_at ? Date.parse(pickup.expires_at) : NaN;
  if (!Number.isFinite(deadline)) return "Deadline unavailable";
  return deadline <= now ? "Expired" : "Ready for Pickup";
}
export function renewablePickup(state: string) {
  return state === "Expired" || state === "Deadline unavailable";
}
