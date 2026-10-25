"use client";
import { useState, type FormEvent } from "react";
import type { Claim, Item } from "../../lib/types";
import type { Correspondence } from "../../services/workspaceService";
import { Badge, PrivacyNote, dateLabel } from "./ui";
import {
  claimStatusText,
  reportCorrespondence,
  validateResponse,
} from "./studentExperience";

export function OwnershipResponse({
  claim,
  submit,
}: {
  claim: Claim;
  submit: (matchId: string, answer: string) => Promise<void>;
}) {
  const [answer, setAnswer] = useState(claim.answers || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [received, setReceived] = useState(false);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || received) return;
    const validation = validateResponse(answer);
    setError(validation);
    if (validation) return;
    setBusy(true);
    try {
      await submit(claim.matchId, answer.trim());
      setReceived(true);
    } catch {
      setError(
        "Your response could not be confirmed. Your draft is still here. Refresh the claim status before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (received)
    return (
      <p role="status">
        Response received. Your claim is awaiting staff review.
      </p>
    );
  if (claim.status !== "More information") return null;
  return (
    <form
      className="form-stack"
      onSubmit={send}
      aria-label="Respond to ownership information request"
    >
      <label htmlFor={`answer-${claim.id}`}>
        Additional ownership evidence
      </label>
      <textarea
        id={`answer-${claim.id}`}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        required
        minLength={10}
        maxLength={1500}
        rows={5}
        disabled={busy}
        aria-describedby={`help-${claim.id}`}
      />
      <p id={`help-${claim.id}`}>
        Include your previous evidence and the additional details requested.
        This replaces your current claim answer. Use 10–1,500 characters; do not
        include passwords or full ID numbers.
      </p>
      <PrivacyNote>
        Your response is sent privately to authorized campus staff. It is
        excluded from public Search.
      </PrivacyNote>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <button className="button compact" disabled={busy}>
        {busy ? "Sending privately…" : "Submit private response"}
      </button>
    </form>
  );
}

export default function StudentClaim({
  claim,
  report,
  messages,
  submit,
  showPass,
}: {
  claim: Claim;
  report?: Item;
  messages: Correspondence[];
  submit: (matchId: string, answer: string) => Promise<void>;
  showPass: (claim: Claim) => void;
}) {
  const notes = report ? reportCorrespondence(messages, report.id) : [];
  return (
    <article
      className="panel"
      id={`claim-${claim.id}`}
      style={{ padding: 24, overflowWrap: "anywhere" }}
    >
      <h3>{report?.name || "Ownership claim"}</h3>
      <p>Claim reference: {claim.id}</p>
      <Badge tone={claim.status === "More information" ? "blue" : "neutral"}>
        {claim.status}
      </Badge>
      {report && (
        <p>
          Report status:{" "}
          {report.status === "Matching" ? "Active" : report.status}
        </p>
      )}
      <p>{claimStatusText(claim)}</p>
      {claim.status === "More information" && (
        <>
          <h4>Private report correspondence</h4>
          <p>
            These messages relate to this lost report and may cover more than
            one claim. They are not linked to a specific claim by the current
            service.
          </p>
          {notes.length ? (
            <div className="message-list">
              {notes.map((note) => (
                <article
                  key={note.id}
                  className={
                    note.fromStaff ? "staff-message" : "student-message"
                  }
                >
                  <strong>{note.fromStaff ? "Campus staff" : "You"}</strong>
                  <p
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {note.body}
                  </p>
                  <time>{dateLabel(note.createdAt)}</time>
                </article>
              ))}
            </div>
          ) : (
            <p>
              No detailed request was included in the report correspondence.
              Provide additional ownership evidence, or contact campus staff to
              clarify what is needed.
            </p>
          )}
          <OwnershipResponse
            key={`${claim.id}-${claim.status}`}
            claim={claim}
            submit={submit}
          />
        </>
      )}
      {claim.status === "Approved" && claim.code && (
        <>
          <p>
            Pickup location:{" "}
            {claim.pickupLocation ||
              "Contact campus staff for pickup instructions."}
          </p>
          <button
            className="button secondary compact"
            onClick={() => showPass(claim)}
          >
            View pickup pass
          </button>
        </>
      )}
    </article>
  );
}
