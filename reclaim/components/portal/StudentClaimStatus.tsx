"use client";
import { useState } from "react";
import type { Claim, Item } from "../../lib/types";
import type { Correspondence } from "../../services/workspaceService";
import { studentClaimState, validateStudentAnswer } from "./studentClaimState";
import { Badge, PrivacyNote, dateLabel } from "./ui";
import styles from "./StudentExperience.module.css";

export default function StudentClaimStatus({ claim, report, messages, busy, onRespond, onShowPass }: {
  claim: Claim;
  report?: Item;
  messages: Correspondence[];
  busy: boolean;
  onRespond: (answer: string) => Promise<boolean>;
  onShowPass: () => void;
}) {
  const presentation = studentClaimState(claim, report);
  const [answer, setAnswer] = useState(claim.answers || "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const staffNotes = messages.filter(m => m.fromStaff && m.reportId === report?.id);
  return (
    <div className={`claim-status ${styles.claim}`}>
      <Badge tone="blue">{claim.status}</Badge>
      <h3>{presentation.title}</h3>
      <p>{presentation.message}</p>
      {staffNotes.length > 0 && (
        <section className={styles.request} aria-label="Private staff messages for this report">
          <h4>Campus team messages</h4>
          <p>These messages concern your report and may cover more than one claim. Respond to the request relevant to this claim.</p>
          {staffNotes.map(note => <article key={note.id}>
            <p className={styles.preserveText}>{note.body}</p>
            <time dateTime={note.createdAt}>{dateLabel(note.createdAt)}</time>
          </article>)}
        </section>
      )}
      {presentation.canRespond && (
        <form className="form-stack" onSubmit={async e => {
          e.preventDefault();
          if (busy || submitting) return;
          const validation = validateStudentAnswer(answer);
          setError(validation);
          if (validation) return;
          setSubmitting(true);
          try { await onRespond(answer.trim()); }
          finally { setSubmitting(false); }
        }}>
          <label htmlFor={`claim-response-${claim.id}`}>Updated ownership evidence</label>
          <textarea id={`claim-response-${claim.id}`} value={answer} onChange={e => setAnswer(e.target.value)}
            required minLength={10} maxLength={1500} rows={5} disabled={busy || submitting}
            aria-describedby={`claim-help-${claim.id}${error ? ` claim-error-${claim.id}` : ""}`} aria-invalid={Boolean(error)} />
          <p id={`claim-help-${claim.id}`} className={styles.help}>
            Your previous answer is included so you can revise it. This replaces the claim answer; include all evidence staff need. Use 10–1,500 characters. Never include passwords or full ID numbers.
          </p>
          {error && <p id={`claim-error-${claim.id}`} className="alert error" role="alert">{error}</p>}
          <PrivacyNote>Only you and authorized campus staff can access this response. Found-item photos and identifying details stay hidden.</PrivacyNote>
          <button className="button" disabled={busy || submitting}>{submitting ? "Sending response…" : "Send private response"}</button>
        </form>
      )}
      {presentation.canShowPass && <button className="button" disabled={busy} onClick={onShowPass}>View pickup pass</button>}
    </div>
  );
}
