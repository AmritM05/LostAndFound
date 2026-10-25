"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import StudentHandoverSteps from "./StudentHandoverSteps";
import { campus } from "../../lib/campus";
import {
  configuredDropoffs,
  type StudentDropoffLoader,
  type StudentDropoffResult,
} from "./studentDropoffs";

export function DropoffContent({
  loading,
  error,
  result,
}: {
  loading: boolean;
  error: boolean;
  result: StudentDropoffResult | null;
}) {
  if (loading) return <p role="status">Loading campus drop-off guidance…</p>;
  if (error)
    return (
      <p role="alert">
        Drop-off guidance could not be loaded. Contact authorized campus staff
        for a confirmed intake location.
      </p>
    );
  return (
    <>
      {result?.source === "campus-config" && (
        <p>
          These locations come from campus configuration. Live staff-managed
          intake locations are not available here yet. Confirm opening hours
          with campus staff.
        </p>
      )}
      {result?.zones.length ? (
        <div className="location-list">
          {result.zones.map((zone) => (
            <div key={zone.id}>
              <div>
                <strong>{zone.name}</strong>
                <p style={{ overflowWrap: "anywhere" }}>
                  {zone.instructions ||
                    "Contact campus staff for opening hours and handover instructions."}
                </p>
                <a
                  className="text-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${zone.lat},${zone.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open {zone.name} in Google Maps
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p>
          No confirmed intake locations are listed here. Contact{" "}
          {campus.pickupName} or authorized campus staff to arrange a handover.
        </p>
      )}
    </>
  );
}
export default function StudentDropoffGuidance({
  compact = false,
  load = configuredDropoffs,
}: {
  compact?: boolean;
  load?: StudentDropoffLoader;
}) {
  const [result, setResult] = useState<StudentDropoffResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (compact) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    load()
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [compact, load, attempt]);
  return (
    <section
      className="panel"
      aria-label="Found an item guidance"
      style={{ padding: 24 }}
    >
      <h2>Found an item?</h2>
      <p>
        Turn it in to authorized staff at {campus.name}. Students cannot submit
        found-item reports; campus staff record items after receiving them. Keep
        photographs and identifying details private.
      </p>
      {compact ? (
        <Link className="text-link" href="/student/map">
          View campus drop-off guidance
        </Link>
      ) : (
        <>
          <p>
            Map markers identify campus buildings. A building marker alone does
            not mean it accepts found items.
          </p>
          <StudentHandoverSteps directoryConnected={result?.source === "approved-api"} />
          <DropoffContent loading={loading} error={error} result={result} />
          {error && (
            <button
              className="button secondary compact"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          )}
        </>
      )}
    </section>
  );
}
