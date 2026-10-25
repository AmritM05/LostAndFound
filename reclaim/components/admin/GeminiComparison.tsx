"use client";
import { useState, type FormEvent } from "react";
import { request } from "../../services/apiClient";
export default function GeminiComparison({
  reports,
  onApplied,
}: {
  reports: any[];
  onApplied: () => Promise<void>;
}) {
  const [lost, setLost] = useState(""),
    [found, setFound] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !confirmed) return;
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const result = await request("/api/admin/ai-matching/", {
        method: "POST",
        body: JSON.stringify({
          lostId: lost,
          foundId: found,
          confirmSynthetic: confirmed,
        }),
      });
      if (result.reason === "incompatible")
        setStatus(
          "No match: a deterministic contradiction or closed report blocks this pair. No data was sent to Gemini.",
        );
      else if (
        !result.applied &&
        [
          "stale-report",
          "active-recovery",
          "dismissed",
          "unavailable",
        ].includes(result.reason)
      )
        setStatus(
          "Comparison not applied: this pair changed, was dismissed, or has an active recovery. Refresh before trying another pair.",
        );
      else if (result.mode === "gemini")
        setStatus(
          `Actual Gemini similarity used (${result.channels.join(", ")}). Ranking index ${result.assessment?.score ?? "unavailable"}/100. ${result.reason === "below-threshold" ? "Below the candidate threshold." : "Staff ownership verification is still required."}`,
        );
      else
        setStatus(
          "Deterministic fallback used. Gemini was disabled, unavailable, or had no usable inputs. No AI-assisted label was added.",
        );
      if (result.applied) await onApplied();
    } catch {
      setError(
        "Comparison could not be completed. Your reports and intake remain saved. Check AI configuration/migrations and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const available = reports.filter(
    (r) => !["Returned", "Archived", "Ready for Pickup"].includes(r.status),
  );
  return (
    <section
      className="panel staff-panel"
      aria-label="Gemini synthetic demo comparison"
    >
      <h2>Gemini similarity — synthetic demo only</h2>
      <p className="staff-help">
        Optional staff-triggered comparison. Google receives the selected
        reports’ item names/descriptions and one prepared private photograph per
        report when available. Ownership answers, staff notes, identities and
        locations are excluded. Report creation never waits for Gemini.
      </p>
      <p className="staff-help">
        Server AI and synthetic-demo settings must both be enabled. Real-user
        processing is unsupported until an approved consent and data-handling
        workflow is implemented. A key alone never enables processing.
      </p>
      <form className="form-stack" onSubmit={submit}>
        <div className="staff-form-grid">
          {(["lost", "found"] as const).map((type) => (
            <label key={type}>
              {type === "lost"
                ? "Lost synthetic report"
                : "Found synthetic report"}
              <select
                required
                disabled={busy}
                value={type === "lost" ? lost : found}
                onChange={(e) => {
                  (type === "lost" ? setLost : setFound)(e.target.value);
                  setConfirmed(false);
                }}
              >
                <option value="">Choose a report</option>
                {available
                  .filter((r) => r.type === type)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        </div>
        <label className="staff-checkbox">
          <input
            type="checkbox"
            checked={confirmed}
            disabled={busy}
            onChange={(e) => setConfirmed(e.target.checked)}
            required
          />
          I confirm both selected reports, descriptions and photographs are
          synthetic demo data approved for transmission to Google. No real
          student data.
        </label>
        <button
          className="button secondary compact"
          disabled={busy || !confirmed || !lost || !found}
        >
          {busy ? "Comparing privately…" : "Compare using Gemini"}
        </button>
      </form>
      {status && (
        <p role="status" className="staff-help">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
    </section>
  );
}
