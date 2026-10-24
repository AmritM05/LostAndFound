"use client";
import { useEffect, useState, type FormEvent } from "react";
import { campus } from "../../lib/campus";
import { DropoffZone } from "../../lib/types";
import * as api from "../../services/workspaceService";
import BuildingSelector from "../BuildingSelector";
import { Badge, Empty, SectionTitle } from "./ui";
export default function DropoffZones() {
  const [zones, setZones] = useState<DropoffZone[]>([]),
    [buildingId, setBuildingId] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setZones(await api.listDropoffZones());
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    const form = e.currentTarget,
      d = new FormData(form),
      building = campus.locations.find((l) => l.id === buildingId);
    if (!building) {
      setError(
        "Select the campus building that contains this approved intake zone.",
      );
      return;
    }
    setBusy(true);
    try {
      await api.saveDropoffZone({
        id: "",
        campusId: campus.id,
        name: String(d.get("name")).trim(),
        buildingId,
        building: building.name,
        description: String(d.get("description")).trim(),
        lat: building.lat,
        lng: building.lng,
        active: true,
      });
      form.reset();
      setBuildingId("");
      await load();
      setMessage("Approved drop-off zone added.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <SectionTitle
        title="Approved drop-off zones"
        description="Control which staffed locations can receive found items. A campus building alone is not an intake location."
      />
      <section className="panel zone-editor">
        <form className="zone-form" onSubmit={submit}>
          <label>
            Zone name
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              placeholder="e.g. Ohio Union information desk"
            />
          </label>
          <BuildingSelector
            label="Building"
            optional={false}
            value={buildingId}
            onChange={(b) => setBuildingId(b?.id || "")}
          />
          <label className="zone-wide">
            Public intake instructions or address
            <textarea
              name="description"
              maxLength={500}
              rows={2}
              placeholder="Where students should bring found items. Do not include staff-only storage locations."
            />
          </label>
          <div className="zone-wide">
            <button className="button" disabled={busy}>
              Add approved zone
            </button>
          </div>
        </form>
      </section>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="alert success" role="status">
          {message}
        </div>
      )}
      <section className="panel zone-list">
        {zones.length ? (
          zones.map((z) => (
            <div className="zone-row" key={z.id}>
              <div>
                <h3>{z.name}</h3>
                <p>{z.building}</p>
                <p>{z.description}</p>
              </div>
              <Badge tone={z.active ? "blue" : "neutral"}>
                {z.active ? "Active" : "Inactive"}
              </Badge>
              <button
                className="button secondary compact"
                disabled={busy}
                onClick={async () => {
                  setError("");
                  setBusy(true);
                  try {
                    await api.saveDropoffZone({ ...z, active: !z.active });
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {z.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          ))
        ) : (
          <Empty title="No approved drop-off zones">
            Add a staffed intake location before entering found inventory.
          </Empty>
        )}
      </section>
    </>
  );
}
