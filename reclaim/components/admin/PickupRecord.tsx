"use client";
import { useState, type FormEvent } from "react";
import { type RecoveryPickup, renewablePickup } from "./recoveryState";

export default function PickupRecord({
  pickup,
  status,
  itemName,
  claimant,
  zones,
  busy,
  renew,
}: {
  pickup: RecoveryPickup;
  status: string;
  itemName: string;
  claimant: string;
  zones: { id: string; name: string }[];
  busy: boolean;
  renew: (id: string, zoneId: string) => Promise<void>;
}) {
  const deadline =
    pickup.expires_at && Number.isFinite(Date.parse(pickup.expires_at))
      ? pickup.expires_at
      : null;
  const [confirm, setConfirm] = useState(false);
  const [zoneId, setZoneId] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !renewablePickup(status)) return;
    if (!zoneId || !zones.some((z) => z.id === zoneId)) {
      setError("Choose an active pickup location.");
      return;
    }
    setError("");
    try {
      await renew(pickup.id, zoneId);
      setConfirm(false);
    } catch {
      setError(
        "Renewal could not be confirmed. Refresh pickup records before retrying.",
      );
    }
  }
  return (
    <article className="staff-history" style={{ overflowWrap: "anywhere" }}>
      <div className="staff-pickup">
        <div>
          <strong>{itemName}</strong>
          <small>
            {claimant} · {pickup.location || "Location unavailable"}
          </small>
          <small>
            {pickup.used_at
              ? `Collected ${new Date(pickup.used_at).toLocaleString()}`
              : deadline
                ? `Deadline ${new Date(deadline).toLocaleString()}`
                : "No valid pickup deadline recorded"}
          </small>
        </div>
        {status === "Ready for Pickup" && (
          <code>{pickup.display_code || "Code unavailable"}</code>
        )}
        <span className="staff-pill">{status}</span>
      </div>
      {renewablePickup(status) && (
        <>
          <p className="staff-help">
            The item remains in staff custody. A missed deadline does not mark
            it Returned. Renewing issues a private pass valid for seven days and
            invalidates the previous code.
          </p>
          {!zones.length ? (
            <p role="status">
              Activate a pickup location in Drop-Off Zones before renewing this
              pass.
            </p>
          ) : !confirm ? (
            <button
              className="button secondary compact"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Renew pickup pass
            </button>
          ) : (
            <form
              className="form-stack"
              onSubmit={submit}
              aria-label={`Renew pickup pass for ${itemName}`}
            >
              <label>
                Active pickup location
                <select
                  required
                  value={zoneId}
                  disabled={busy}
                  onChange={(e) => setZoneId(e.target.value)}
                >
                  <option value="">Choose a pickup location</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                The old code will stop working. The claimant receives a private
                update with the new deadline.
              </p>
              <div className="staff-actions">
                <button className="button compact" disabled={busy}>
                  Confirm renewal
                </button>
                <button
                  type="button"
                  className="button secondary compact"
                  disabled={busy}
                  onClick={() => {
                    setConfirm(false);
                    setError("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </>
      )}
      {status === "Needs review" && (
        <p className="staff-help">
          The claim or report state is inconsistent. Review the linked recovery
          before taking action.
        </p>
      )}
      {status === "Closed" && (
        <p className="staff-help">
          A linked recovery is closed. This pass cannot be renewed or used.
        </p>
      )}
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
