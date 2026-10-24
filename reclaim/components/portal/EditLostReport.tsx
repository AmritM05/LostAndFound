"use client";
import { useState, type FormEvent } from "react";
import { Item } from "../../lib/types";
import { campus } from "../../lib/campus";
import BuildingSelector from "../BuildingSelector";
import CampusMap from "../CampusMap";
import * as api from "../../services/workspaceService";
export default function EditLostReport({
  item,
  details,
  onSaved,
  onCancel,
}: {
  item: Item;
  details: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
      ...item,
      locationKnown: item.locationKnown ?? item.lat != null,
    }),
    [privateDetail, setPrivate] = useState(details),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [mapOpen, setMapOpen] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const known =
        draft.locationKnown && draft.lat != null && draft.lng != null;
      await api.editLostReport(
        {
          ...draft,
          locationKnown: known,
          lat: known ? draft.lat : null,
          lng: known ? draft.lng : null,
          buildingId: known ? draft.buildingId : null,
        },
        privateDetail,
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack edit-report-form">
      <h3>Edit your lost report</h3>
      <label>
        Item type
        <input
          required
          minLength={2}
          maxLength={80}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>
      <label>
        General color or appearance
        <input
          required
          maxLength={80}
          value={draft.color}
          onChange={(e) => setDraft({ ...draft, color: e.target.value })}
        />
      </label>
      <label>
        Secondary color (optional)
        <input
          maxLength={80}
          value={draft.secondaryColor || ""}
          onChange={(e) =>
            setDraft({ ...draft, secondaryColor: e.target.value })
          }
        />
      </label>
      <label>
        Private description
        <textarea
          maxLength={1500}
          rows={3}
          value={draft.description}
          onChange={(e) =>
            setDraft({
              ...draft,
              description: e.target.value,
              features: e.target.value,
            })
          }
        />
      </label>
      <label>
        Private ownership details
        <textarea
          maxLength={1000}
          rows={3}
          value={privateDetail}
          onChange={(e) => setPrivate(e.target.value)}
        />
      </label>
      <label className="unknown-location">
        <input
          type="checkbox"
          checked={draft.locationKnown === false}
          onChange={(e) => {
            if (e.target.checked)
              setDraft({
                ...draft,
                location: "Location unknown",
                locationKnown: false,
                buildingId: null,
                lat: null,
                lng: null,
              });
            else setDraft({ ...draft, locationKnown: true });
          }}
        />
        <span>I don’t know where I lost this item</span>
      </label>
      {draft.locationKnown !== false && (
        <>
          <BuildingSelector
            value={draft.buildingId || ""}
            onChange={(b) =>
              setDraft({
                ...draft,
                buildingId: b?.id || null,
                location: b?.name || "Location unknown",
                locationKnown: !!b,
                lat: b?.lat ?? null,
                lng: b?.lng ?? null,
              })
            }
          />
          <details
            className="optional-map"
            onToggle={(e) => setMapOpen(e.currentTarget.open)}
          >
            <summary>
              Choose an approximate location<small>Optional</small>
            </summary>
            {mapOpen && (
              <CampusMap
                value={
                  draft.lat != null
                    ? { lat: draft.lat, lng: draft.lng! }
                    : undefined
                }
                onSelect={(p) =>
                  setDraft({
                    ...draft,
                    location: p.name || "Approximate campus location",
                    locationKnown: true,
                    buildingId:
                      campus.locations.find((l) => l.name === p.name)?.id ||
                      null,
                    lat: p.lat,
                    lng: p.lng,
                  })
                }
              />
            )}
          </details>
        </>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="button" disabled={busy}>
          Save changes
        </button>
      </div>
    </form>
  );
}
