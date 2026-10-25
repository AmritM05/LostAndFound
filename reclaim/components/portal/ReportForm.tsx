"use client";
import { useState, type FormEvent } from "react";
import {
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import { campus } from "../../lib/campus";
import { categories, fieldsFor, localDateTime } from "../../lib/reportFields";
import { Item, Profile, ReportType, DropoffZone } from "../../lib/types";
import CampusMap from "../CampusMap";
import BuildingSelector from "../BuildingSelector";
import PhotoUploader from "../PhotoUploader";
import { PrivacyNote } from "./ui";
export default function ReportForm({
  user,
  onSubmit,
  mode = "lost",
  zones = [],
}: {
  user: Profile | null;
  mode?: ReportType;
  zones?: DropoffZone[];
  onSubmit: (
    item: Item,
    privateDetail: string,
    files: File[],
    onProgress?: (percent: number) => void,
  ) => Promise<void>;
}) {
  const [step, setStep] = useState(0),
    [category, setCategory] = useState("Electronics"),
    [files, setFiles] = useState<File[]>([]),
    [progress, setProgress] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    model: "",
    color: "",
    secondaryColor: "",
    size: "",
    description: "",
    privateDetail: "",
    locationUnknown: false,
    dropoffZoneId: "",
    receivedAt: localDateTime(),
    custodyStatus: "Received",
    staffNotes: "",
    locationId: "",
    locationName: "",
    lat: NaN,
    lng: NaN,
    date: localDateTime(),
  });
  const [mapOpen, setMapOpen] = useState(false);
  const type = mode;
  const fields = fieldsFor(category);
  const set = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (step < 3) {
      if (step === 1 && !form.name.trim()) {
        setError("Enter an item type.");
        return;
      }
      if (step === 0 && mode === "found" && !form.dropoffZoneId) {
        setError(
          "Select an approved drop-off zone before recording found inventory.",
        );
        return;
      }
      setStep(step + 1);
      return;
    }
    if (!user) {
      setError(
        "Sign in to submit your report. Your form will stay on this page until you leave.",
      );
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const item: Item = {
        id: crypto.randomUUID(),
        reporterId: user.id,
        type,
        name: form.name.trim(),
        category,
        brand: fields.brand ? form.brand.trim() : "",
        model: fields.model ? form.model.trim() : "",
        size: fields.size ? form.size.trim() : "",
        color: form.color.trim(),
        secondaryColor: form.secondaryColor.trim(),
        description: form.description.trim(),
        features: form.description.trim(),
        location:
          !form.locationUnknown && form.locationName
            ? form.locationName
            : "Location unknown",
        locationKnown: !form.locationUnknown && !!form.locationName,
        buildingId:
          !form.locationUnknown && form.locationId ? form.locationId : null,
        lat:
          !form.locationUnknown && Number.isFinite(form.lat) ? form.lat : null,
        lng:
          !form.locationUnknown && Number.isFinite(form.lng) ? form.lng : null,
        ...(mode === "found"
          ? {
              dropoffZoneId: form.dropoffZoneId,
              foundAt: new Date(form.date).toISOString(),
              receivedAt: new Date(form.receivedAt).toISOString(),
              custodyStatus: form.custodyStatus as Item["custodyStatus"],
              staffNotes: form.staffNotes,
            }
          : {}),
        date: new Date(form.date).toISOString(),
        status: "Matching",
        image: "",
      };
      await onSubmit(item, form.privateDetail.trim(), files, setProgress);
      setSubmitted(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (submitted)
    return (
      <section className="panel report-success">
        <CheckCircle2 size={36} />
        <h2>
          {mode === "found"
            ? "Found item received"
            : "Your lost report has been saved"}
        </h2>
        <p>
          {mode === "found"
            ? "The item is in staff inventory and matching has started."
            : "You can find your report and its photos in My Reports."}
        </p>
        <a
          className="button"
          href={mode === "found" ? "/admin/reports" : "/student/reports"}
        >
          {mode === "found" ? "View staff reports" : "View my reports"}
          <ArrowRight size={16} />
        </a>
      </section>
    );
  return (
    <div className="report-layout">
      <section className="panel report-form">
        <div className="form-progress">
          {[
            "Category",
            "Item details",
            "Location & time",
            "Photos & review",
          ].map((name, i) => (
            <span
              key={name}
              className={step === i ? "current" : step > i ? "complete" : ""}
            >
              <b>{step > i ? "✓" : i + 1}</b>
              {name}
            </span>
          ))}
        </div>
        <form onSubmit={submit} className="form-stack">
          <div className="form-section-heading">
            <span className="eyebrow">STEP {step + 1} OF 4</span>
            <h2>
              {
                [
                  "Start a report",
                  "Tell us about the item",
                  "Where and when?",
                  "Add private photos & review",
                ][step]
              }
            </h2>
            <p>
              {
                [
                  mode === "lost"
                    ? "Choose the category of the item you lost."
                    : "Record an item received at an approved campus drop-off zone.",
                  "These details are excluded from public Search.",
                  "Location is optional. Add a building or map point only if you know it.",
                  "Photographs are optional and are never included in public search.",
                ][step]
              }
            </p>
          </div>
          {step === 0 && (
            <>
              <label>
                Item category <span className="required">Required</span>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setForm((f) => ({
                      ...f,
                      name: "",
                      brand: "",
                      model: "",
                      size: "",
                      description: "",
                      privateDetail: "",
                    }));
                  }}
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              {mode === "found" && (
                <>
                  <label>
                    Approved drop-off zone
                    <span className="required">Required</span>
                    <select
                      required
                      value={form.dropoffZoneId}
                      onChange={(e) => set("dropoffZoneId", e.target.value)}
                    >
                      <option value="">
                        Select an approved intake location
                      </option>
                      {zones
                        .filter((z) => z.active)
                        .map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name} · {z.building}
                          </option>
                        ))}
                    </select>
                  </label>
                  {!zones.some((z) => z.active) && (
                    <div className="alert info">
                      No approved intake zones are configured. Add one in Admin
                      → Drop-off zones before receiving an item.
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {step === 1 && (
            <>
              <label>
                {fields.itemLabel}
                <span className="required">Required</span>
                <input
                  required
                  maxLength={80}
                  value={form.name}
                  placeholder={fields.itemPlaceholder}
                  onChange={(e) => set("name", e.target.value)}
                />
              </label>
              <div className="field-pair">
                {fields.brand && (
                  <label>
                    Brand <small>Optional</small>
                    <input
                      maxLength={60}
                      value={form.brand}
                      placeholder={
                        category === "Clothing"
                          ? "e.g. Uniqlo"
                          : "e.g. Apple, Sony, or another brand"
                      }
                      onChange={(e) => set("brand", e.target.value)}
                    />
                  </label>
                )}
                {fields.model && (
                  <label>
                    Model <small>Optional</small>
                    <input
                      maxLength={60}
                      value={form.model}
                      placeholder={
                        category === "Electronics"
                          ? "e.g. Pro, 2nd generation"
                          : "e.g. Model or capacity"
                      }
                      onChange={(e) => set("model", e.target.value)}
                    />
                  </label>
                )}
                {fields.size && (
                  <label>
                    Size <small>Optional</small>
                    <select
                      value={form.size}
                      onChange={(e) => set("size", e.target.value)}
                    >
                      <option value="">Select size</option>
                      {[
                        "XS",
                        "S",
                        "M",
                        "L",
                        "XL",
                        "XXL",
                        "Other / unknown",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <label>
                {category === "Keys" ? "General appearance" : "General color"}
                <span className="required">Required</span>
                <input
                  required
                  maxLength={80}
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  placeholder={
                    category === "Keys"
                      ? "e.g. Silver keys with a plain ring"
                      : category === "Clothing"
                        ? "e.g. Navy blue"
                        : category === "Wallet"
                          ? "e.g. Brown"
                          : "e.g. Black"
                  }
                />
              </label>
              <label>
                Secondary color <small>Optional</small>
                <input
                  maxLength={80}
                  value={form.secondaryColor}
                  onChange={(e) => set("secondaryColor", e.target.value)}
                  placeholder="e.g. White trim"
                />
              </label>
              <label>
                Private description <small>Optional</small>
                <textarea
                  required={mode === "found"}
                  maxLength={1500}
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder={fields.descriptionPlaceholder}
                />
              </label>
              <label>
                Ownership details <small>Optional · private</small>
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={form.privateDetail}
                  onChange={(e) => set("privateDetail", e.target.value)}
                  placeholder={fields.privatePlaceholder}
                />
              </label>
              <PrivacyNote />
            </>
          )}
          {step === 2 && (
            <>
              <label className="unknown-location">
                <input
                  type="checkbox"
                  checked={form.locationUnknown}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      locationUnknown: e.target.checked,
                    }))
                  }
                />
                <span>
                  {mode === "lost"
                    ? "I don't know where I lost this item"
                    : "The finder did not know where it was found"}
                </span>
              </label>
              {!form.locationUnknown && (
                <>
                  <BuildingSelector
                    value={form.locationId}
                    onChange={(l) =>
                      setForm((f) => ({
                        ...f,
                        locationId: l?.id || "",
                        locationName: l?.name || "",
                        lat: l?.lat ?? NaN,
                        lng: l?.lng ?? NaN,
                      }))
                    }
                  />
                  <details
                    className="optional-map"
                    onToggle={(e) => setMapOpen(e.currentTarget.open)}
                  >
                    <summary>
                      {form.locationName
                        ? "Adjust approximate map location"
                        : "Choose an approximate map location"}{" "}
                      <small>Optional</small>
                    </summary>
                    {mapOpen && (
                      <CampusMap
                        value={
                          Number.isFinite(form.lat)
                            ? { lat: form.lat, lng: form.lng }
                            : undefined
                        }
                        onSelect={(p) => {
                          const l = campus.locations.find(
                            (l) => l.name === p.name,
                          );
                          setForm((f) => ({
                            ...f,
                            lat: p.lat,
                            lng: p.lng,
                            locationId: l?.id || "",
                            locationName:
                              p.name || "Approximate campus location",
                          }));
                        }}
                      />
                    )}
                  </details>
                  {form.locationName && (
                    <p className="selected-location">
                      Selected: {form.locationName}
                    </p>
                  )}
                  <p className="field-help">
                    No building or map point is required. If left blank, the
                    report is saved with location unknown.
                  </p>
                </>
              )}
              <label>
                {type === "lost"
                  ? "Date and approximate time last seen"
                  : "Date and time found"}
                <span className="required">Required</span>
                <input
                  type="datetime-local"
                  required
                  value={form.date}
                  max={localDateTime()}
                  onChange={(e) => set("date", e.target.value)}
                />
              </label>
              {mode === "found" && (
                <>
                  <label>
                    Date and time received by staff
                    <span className="required">Required</span>
                    <input
                      type="datetime-local"
                      required
                      value={form.receivedAt}
                      max={localDateTime()}
                      onChange={(e) => set("receivedAt", e.target.value)}
                    />
                  </label>
                  <label>
                    Initial custody status
                    <select
                      value={form.custodyStatus}
                      onChange={(e) => set("custodyStatus", e.target.value)}
                    >
                      <option>Received</option>
                      <option>Stored</option>
                    </select>
                  </label>
                  <label>
                    Private staff notes<small>Optional · staff only</small>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={form.staffNotes}
                      onChange={(e) => set("staffNotes", e.target.value)}
                      placeholder="Intake or handling notes. Never displayed to students."
                    />
                  </label>
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <PhotoUploader
                files={files}
                onChange={setFiles}
                disabled={busy}
              />
              {busy && (
                <div role="status">
                  <p>
                    {files.length && progress < 100
                      ? `Uploading photos · ${progress}%`
                      : "Saving report…"}
                  </p>
                  <progress
                    value={progress}
                    max={100}
                    aria-label="Upload progress"
                  />
                </div>
              )}
              <div className="review-summary">
                <h3>Report summary</h3>
                <dl>
                  <div>
                    <dt>Report</dt>
                    <dd>{type === "lost" ? "Lost item" : "Found item"}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{category}</dd>
                  </div>
                  <div>
                    <dt>Item</dt>
                    <dd>{form.name}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {!form.locationUnknown && form.locationName
                        ? form.locationName
                        : "Location unknown"}
                    </dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{new Date(form.date).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Private photos</dt>
                    <dd>{files.length}</dd>
                  </div>
                </dl>
              </div>
              <PrivacyNote>
                {mode === "lost"
                  ? "Your report and photos are saved privately and excluded from public Search."
                  : "Public Search shows only the category, general drop-off building, date, and generic found status. Photos and identifying details stay private."}
              </PrivacyNote>
            </>
          )}
          {error && (
            <div role="alert" className="alert error">
              {error}
            </div>
          )}
          <div className="form-actions">
            {step > 0 && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={15} />
                Back
              </button>
            )}
            <button className="button" disabled={busy}>
              {busy ? <LoaderCircle size={16} className="spin" /> : null}
              {busy ? "Submitting…" : step === 3 ? "Submit report" : "Continue"}
              {!busy && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </section>
      <aside className="report-help">
        <LockKeyhole size={19} />
        <h3>Private report details</h3>
        <p>
          Reports and photographs are saved to Magpie. Use sample information
          during the hackathon demo.
        </p>
        <p>Photos and identifying details never appear in generic Search.</p>
        <div className="help-divider" />
        <h3>Found a university ID?</h3>
        <p>
          Bring it to your campus ID office. Never include a full student ID or
          payment card number in a report.
        </p>
      </aside>
    </div>
  );
}
