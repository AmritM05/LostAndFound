"use client";
import { useEffect, useRef, useState } from "react";
import { deleteReport } from "../services/workspaceService";
export default function DeleteReportAction({
  reportId,
  blocked,
  onDeleted,
}: {
  reportId: string;
  blocked: boolean;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const wasConfirming = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) cancel.current?.focus();
    else if (wasConfirming.current) trigger.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);
  function close() {
    if (busy) return;
    setConfirming(false);
    setError("");
    trigger.current?.focus();
  }
  return (
    <div className="delete-report-action">
      {blocked ? (
        <>
          <button className="text-link destructive" disabled>
            Delete Report
          </button>
          <p className="field-help">
            This report cannot be deleted while an active recovery is in
            progress.
          </p>
        </>
      ) : !confirming ? (
        <button
          ref={trigger}
          type="button"
          className="text-link destructive"
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
        >
          Delete Report
        </button>
      ) : (
        <div
          className="delete-confirmation"
          role="group"
          aria-labelledby="delete-report-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <h3 id="delete-report-title">Delete this report?</h3>
          <p>
            This will permanently remove this lost-item report and stop Magpie
            from matching against it.
          </p>
          {error && (
            <p className="alert error" role="alert">
              {error}
            </p>
          )}
          <div className="delete-confirmation-actions">
            <button
              ref={cancel}
              type="button"
              className="button secondary compact"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button danger compact"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await deleteReport(reportId);
                  onDeleted();
                } catch (error) {
                  setError((error as Error).message);
                  setBusy(false);
                }
              }}
            >
              {busy ? "Deleting…" : "Delete Report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
