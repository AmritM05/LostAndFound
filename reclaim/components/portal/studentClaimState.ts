import type { Claim, Item } from "../../lib/types";

// Presentation only. Server claim/pickup transitions remain authoritative.
export function studentClaimState(claim: Claim, report?: Pick<Item, "status">) {
  const terminal = report?.status === "Returned" || report?.status === "Archived";
  if (claim.status === "Returned" || report?.status === "Returned")
    return { title: "Item returned", message: "Your recovery is complete. This pickup pass can no longer be used.", canRespond: false, canShowPass: false };
  if (report?.status === "Archived")
    return { title: "Report closed", message: "This report is archived. Contact campus staff if you need help with its history.", canRespond: false, canShowPass: false };
  const canShowPass = !terminal && claim.status === "Approved" && Boolean(claim.code?.trim());
  switch (claim.status) {
    case "More information":
      return { title: "Your response is needed", message: "Review the campus team's request and send updated ownership evidence privately. Sending a response puts your claim back in the review queue.", canRespond: true, canShowPass: false };
    case "Approved":
      return { title: canShowPass ? "Ready for pickup" : "Pickup pass unavailable", message: canShowPass ? "Bring your private pickup pass and university identity to the campus desk shown on your pass." : "No current pickup code is available. It may have expired or been withdrawn. Contact campus staff for help; do not travel based on an old pass.", canRespond: false, canShowPass };
    case "Rejected":
      return { title: "Claim reviewed", message: "Campus staff could not verify this claim. Your other lost reports and possible matches remain available.", canRespond: false, canShowPass: false };
    default:
      return { title: "Awaiting staff review", message: "Your ownership evidence has been submitted privately. You do not need to submit it again while staff review your claim.", canRespond: false, canShowPass: false };
  }
}

export function validateStudentAnswer(answer: string) {
  const length = answer.trim().length;
  return length < 10
    ? "Enter at least 10 characters of ownership evidence."
    : length > 1500
      ? "Keep your response within 1,500 characters."
      : "";
}
