"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PackagePlus,
  Files,
  ScanLine,
  ShieldCheck,
  PackageCheck,
  MapPin,
  LogOut,
  RefreshCw,
  ArrowUpRight,
  X,
} from "lucide-react";
import Brand from "../Brand";
import GeminiComparison from "./GeminiComparison";
import PickupRecord from "./PickupRecord";
import StaffMatchAssessment from "./StaffMatchAssessment";
import { claimReviewable, pickupState, renewablePickup } from "./recoveryState";
import ReportForm from "../portal/ReportForm";
import PrivatePhoto from "../PrivatePhoto";
import { request } from "../../services/apiClient";
import { uploadReportImages } from "../../services/storageService";
import { categories } from "../../lib/reportFields";
import { campus } from "../../lib/campus";
import type { Profile } from "../../lib/types";
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["found", "Found Item Intake", PackagePlus],
  ["reports", "Reports", Files],
  ["matches", "Matches", ScanLine],
  ["claims", "Claims", ShieldCheck],
  ["pickup", "Pickup", PackageCheck],
  ["dropoffs", "Drop-Off Zones", MapPin],
] as const;
const date = (s: string) => (s ? new Date(s).toLocaleString() : "—");
const initial = {
  reports: [],
  matches: [],
  claims: [],
  pickups: [],
  zones: [],
  activity: [],
  buildings: [],
  notes: [],
};
export default function AdminPortal({
  section,
  reportId,
}: {
  section: string;
  reportId?: string;
}) {
  const router = useRouter(),
    [data, setData] = useState<any>(initial),
    [user, setUser] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [pickupFilter, setPickupFilter] = useState("All");
  const [claimFilter, setClaimFilter] = useState("All");
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState({
      type: "",
      category: "",
      status: "",
      date: "",
      location: "",
    }),
    [selected, setSelected] = useState(""),
    [zone, setZone] = useState<any>(null);
  const load = useCallback(async () => {
    try {
      const [{ user }, next] = await Promise.all([
        request("/api/admin/session/"),
        request("/api/admin/workspace/"),
      ]);
      if (!user) {
        router.replace("/admin/login/");
        return;
      }
      setUser(user);
      setData(next);
      setNow(Date.now());
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => {
    void load();
    const focus = () => {
      void load();
    };
    window.addEventListener("focus", focus);
    // Presentation only: no scheduled database writes or automatic expiration.
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(timer);
    };
  }, [load]);
  async function perform(action: () => Promise<any>, message: string) {
    setBusy(true);
    setError("");
    setToast("");
    try {
      await action();
      await load();
      setToast(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const act = (payload: any, message: string) =>
    perform(
      () =>
        request("/api/admin/actions/", {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      message,
    );
  const report = (id: string) => data.reports.find((r: any) => r.id === id);
  const detail = report(reportId || selected);
  const active = (r: any) => !["Returned", "Archived"].includes(r.status);
  const recoveryFor = (c: any) =>
    data.matches.find((m: any) => m.id === c.match_id);
  const statusForPickup = (p: any) => {
    const c = data.claims.find((c: any) => c.id === p.claim_id);
    return pickupState(p, c, c && recoveryFor(c), data.reports, now);
  };
  const actionPickups = data.pickups.filter((p: any) =>
    renewablePickup(statusForPickup(p)),
  );
  const visiblePickups = data.pickups.filter(
    (p: any) =>
      pickupFilter === "All" ||
      (pickupFilter === "Action needed"
        ? ["Expired", "Deadline unavailable", "Needs review"].includes(
            statusForPickup(p),
          )
        : statusForPickup(p) === pickupFilter),
  );
  const visibleClaims = data.claims.filter(
    (c: any) =>
      claimFilter === "All" ||
      (claimFilter === "Action needed"
        ? claimReviewable(c, recoveryFor(c), data.reports)
        : c.status === claimFilter),
  );
  const counts = [
    [
      "Found Items in Custody",
      data.reports.filter((r: any) => r.type === "found" && active(r)).length,
    ],
    [
      "Active Lost Reports",
      data.reports.filter((r: any) => r.type === "lost" && active(r)).length,
    ],
    [
      "Potential Matches",
      data.matches.filter(
        (m: any) =>
          !m.dismissed &&
          active(report(m.lost_report_id) || {}) &&
          active(report(m.found_report_id) || {}),
      ).length,
    ],
    [
      "Pending Claims",
      data.claims.filter(
        (c: any) =>
          c.status === "Pending" &&
          claimReviewable(c, recoveryFor(c), data.reports),
      ).length,
    ],
    [
      "Ready for Pickup",
      data.pickups.filter((p: any) => statusForPickup(p) === "Ready for Pickup")
        .length,
    ],
    ["Pickup Deadlines Requiring Action", actionPickups.length],
    [
      "Awaiting Claimant Information",
      data.claims.filter(
        (c: any) =>
          c.status === "More information" &&
          claimReviewable(c, recoveryFor(c), data.reports),
      ).length,
    ],
    [
      "Returned Items",
      data.reports.filter(
        (r: any) => r.type === "found" && r.status === "Returned",
      ).length,
    ],
  ];
  const zones = data.zones
    .filter((z: any) => z.active)
    .map((z: any) => ({
      id: z.id,
      campusId: campus.id,
      name: z.name,
      buildingId: z.building_id,
      building: z.building,
      description: z.instructions || "",
      lat: z.latitude,
      lng: z.longitude,
      active: z.active,
    }));
  function reportCard(r: any) {
    return (
      <button
        type="button"
        className="staff-report-link"
        onClick={() => setSelected(r.id)}
      >
        <span>
          <strong>{r.name}</strong>
          <small>
            {r.category} · {r.type} · {r.location}
          </small>
        </span>
        <ArrowUpRight size={15} />
      </button>
    );
  }
  function comparison(m: any) {
    return (
      <div className="staff-comparison">
        {[m?.lost_report_id, m?.found_report_id].map((id, i) => {
          const r = report(id);
          return (
            r && (
              <div key={id}>
                <span className="eyebrow">
                  {i ? "FOUND IN CUSTODY" : "LOST REPORT"}
                </span>
                {reportCard(r)}
                <p>{r.description || "No description"}</p>
                <small>{date(r.date)}</small>
              </div>
            )
          );
        })}
      </div>
    );
  }
  async function saveZone(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    await perform(async () => {
      await request("/api/admin/dropoffs/", {
        method: "POST",
        body: JSON.stringify({
          id: zone.id || undefined,
          name: d.get("name"),
          buildingId: d.get("buildingId"),
          instructions: d.get("instructions"),
          lat: Number(d.get("lat")),
          lng: Number(d.get("lng")),
          active: d.get("active") === "on",
          studentVisible: d.get("studentVisible") === "on",
          publicInstructions: String(d.get("publicInstructions") || ""),
        }),
      });
      setZone(null);
    }, "Drop-off zone saved.");
  }
  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <Brand />
        <div className="staff-label">
          <ShieldCheck size={14} /> ADMIN PORTAL
        </div>
        <nav aria-label="Staff navigation">
          {nav.map(([id, label, Icon]) => (
            <Link
              key={id}
              href={id === "overview" ? "/admin/" : `/admin/${id}/`}
              className={section === id ? "active" : ""}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="staff-sidebar-bottom">
          <small>{user?.email || "Campus staff"}</small>
          <button
            disabled={busy}
            onClick={() =>
              perform(async () => {
                await request("/api/admin/session/", { method: "DELETE" });
                router.replace("/admin/login/");
                router.refresh();
              }, "Signed out.")
            }
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>
      <main className="staff-main">
        <header className="staff-topbar">
          <span>Magpie workspace / Campus operations</span>
          <span>
            <i className="staff-dot" />
            Private staff access
          </span>
        </header>
        <div className="staff-content">
          <div className="staff-heading">
            <div>
              <span className="eyebrow">CAMPUS LOST & FOUND</span>
              <h1>{nav.find(([id]) => id === section)?.[1] || "Reports"}</h1>
              <p>
                {
                  {
                    overview: "A clear view of every item’s journey home.",
                    found:
                      "Record an item received by an approved campus desk.",
                    reports: "Review lost reports and private found inventory.",
                    matches:
                      "Compare potential matches before verifying ownership.",
                    claims:
                      "Review private evidence and make an ownership decision.",
                    pickup:
                      "Verify the student’s identity, then confirm the handoff.",
                    dropoffs:
                      "Manage approved intake desks separately from campus buildings.",
                  }[section]
                }
              </p>
            </div>
            <button
              className="button secondary compact"
              disabled={busy || loading}
              onClick={() => void load()}
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          {toast && (
            <div className="staff-toast" role="status">
              {toast}
            </div>
          )}
          {loading ? (
            <div className="panel staff-panel">Loading staff workspace…</div>
          ) : error && !user ? null : (
            <>
              {section === "overview" && (
                <>
                  <div className="staff-stats">
                    {counts.map(([label, value]) => (
                      <article className="panel" key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </article>
                    ))}
                  </div>
                  {actionPickups.length > 0 && (
                    <div className="alert info" role="status">
                      <span>
                        {actionPickups.length} pickup{" "}
                        {actionPickups.length === 1
                          ? "deadline needs"
                          : "deadlines need"}{" "}
                        staff action. Items remain in custody.
                      </span>
                      <Link className="text-link" href="/admin/pickup/">
                        Review pickup deadlines
                      </Link>
                    </div>
                  )}
                  <div className="staff-two-col">
                    <section className="panel staff-panel">
                      <div className="staff-panel-title">
                        <h2>Recent staff activity</h2>
                        <span className="staff-pill">PRIVATE</span>
                      </div>
                      {data.activity.length ? (
                        data.activity.map((a: any) => (
                          <div className="staff-activity" key={a.id}>
                            <i />
                            <div>
                              <strong>{a.action}</strong>
                              <small>
                                {a.staff_name} · {date(a.created_at)}
                              </small>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="staff-empty">
                          Staff activity will appear as items move through
                          intake and recovery.
                        </p>
                      )}
                    </section>
                    <section className="panel staff-panel">
                      <h2>Keep items moving</h2>
                      <p className="staff-help">
                        Start with intake, review possible matches, then verify
                        ownership before arranging pickup.
                      </p>
                      <Link className="button" href="/admin/found/">
                        Record found item
                        <PackagePlus size={17} />
                      </Link>
                      <Link className="staff-quick-link" href="/admin/claims/">
                        Review ownership claims
                        <ArrowUpRight size={16} />
                      </Link>
                      <Link
                        className="staff-quick-link"
                        href="/admin/dropoffs/"
                      >
                        Manage intake locations
                        <ArrowUpRight size={16} />
                      </Link>
                    </section>
                  </div>
                </>
              )}
              {section === "found" &&
                (zones.length ? (
                  <>
                    <section className="panel staff-panel">
                      <h2>Authorized staff intake</h2>
                      <p className="staff-help">
                        Record items physically handed to campus staff. Select
                        an active intake desk and check the found and received
                        times. Photographs and ownership details stay private.
                      </p>
                    </section>
                    <ReportForm
                      user={user}
                      mode="found"
                      zones={zones}
                      onSubmit={async (
                        item,
                        privateDetail,
                        files,
                        onProgress,
                      ) => {
                        const imageIds = await uploadReportImages(
                          files,
                          onProgress,
                          "admin",
                        );
                        await request("/api/admin/reports/", {
                          method: "POST",
                          body: JSON.stringify({
                            item,
                            privateDetail,
                            imageIds,
                          }),
                        });
                        await load();
                      }}
                    />
                  </>
                ) : (
                  <section className="panel staff-panel">
                    <h2>Set up an intake desk first</h2>
                    <p className="staff-help">
                      Found items must be received at an active, approved
                      drop-off zone.
                    </p>
                    <Link className="button" href="/admin/dropoffs/">
                      Manage drop-off zones
                    </Link>
                  </section>
                ))}
              {section === "reports" && (
                <>
                  <div className="panel staff-filters">
                    <label>
                      Type
                      <select
                        value={filter.type}
                        onChange={(e) =>
                          setFilter({ ...filter, type: e.target.value })
                        }
                      >
                        <option value="">All reports</option>
                        <option value="lost">Lost</option>
                        <option value="found">Found</option>
                      </select>
                    </label>
                    <label>
                      Category
                      <select
                        value={filter.category}
                        onChange={(e) =>
                          setFilter({ ...filter, category: e.target.value })
                        }
                      >
                        <option value="">All categories</option>
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={filter.status}
                        onChange={(e) =>
                          setFilter({ ...filter, status: e.target.value })
                        }
                      >
                        <option value="">All statuses</option>
                        {Array.from(
                          new Set(data.reports.map((r: any) => r.status)),
                        ).map((s: string) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      From date
                      <input
                        type="date"
                        value={filter.date}
                        onChange={(e) =>
                          setFilter({ ...filter, date: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Building / location
                      <input
                        placeholder="Search locations"
                        value={filter.location}
                        onChange={(e) =>
                          setFilter({ ...filter, location: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="panel staff-table-wrap">
                    <table className="staff-table">
                      <thead>
                        <tr>
                          <th>Item / category</th>
                          <th>Type</th>
                          <th>Location</th>
                          <th>Reported</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.reports
                          .filter(
                            (r: any) =>
                              (!filter.type || r.type === filter.type) &&
                              (!filter.category ||
                                r.category === filter.category) &&
                              (!filter.status || r.status === filter.status) &&
                              (!filter.date ||
                                r.date.slice(0, 10) >= filter.date) &&
                              r.location
                                .toLowerCase()
                                .includes(filter.location.toLowerCase()),
                          )
                          .map((r: any) => (
                            <tr key={r.id}>
                              <td>
                                <Link href={`/admin/reports/${r.id}/`}>
                                  <strong>{r.name}</strong>
                                  <small>{r.category}</small>
                                </Link>
                              </td>
                              <td>{r.type}</td>
                              <td>{r.location}</td>
                              <td>{date(r.date)}</td>
                              <td>
                                <span className="staff-pill">{r.status}</span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!data.reports.length && (
                      <p className="staff-empty">
                        No reports have been received yet.
                      </p>
                    )}
                  </div>
                </>
              )}
              {section === "matches" && (
                <div className="staff-stack">
                  <GeminiComparison reports={data.reports} onApplied={load} />
                  {data.matches
                    .filter(
                      (m: any) =>
                        !m.dismissed &&
                        active(report(m.lost_report_id) || {}) &&
                        active(report(m.found_report_id) || {}),
                    )
                    .map((m: any) => (
                      <section className="panel staff-panel" key={m.id}>
                        <div className="staff-panel-title">
                          <h2>Potential lost ↔ found match</h2>
                          <span className="staff-confidence">
                            Ranking index {m.score}/100
                          </span>
                        </div>
                        <StaffMatchAssessment reasoning={m?.staff_reasoning} />
                        {comparison(m)}
                        <div className="staff-factors">
                          {Object.entries(m.factors).map(([key, value]) => (
                            <span key={key}>
                              {key} <b>{String(value)}%</b>
                            </span>
                          ))}
                        </div>
                        <p className="staff-help">
                          {m.distance_km == null
                            ? "Location unavailable"
                            : `${Number(m.distance_km).toFixed(2)} km apart`}{" "}
                          · {m.minutes_difference} minutes between reports.
                          Similarity is not proof of ownership.
                        </p>
                        <div className="staff-actions">
                          <button
                            className="button secondary compact"
                            onClick={() => setSelected(m.found_report_id)}
                          >
                            Review Match
                          </button>
                          <Link
                            className="button compact"
                            href="/admin/claims/"
                          >
                            Continue Verification
                          </Link>
                          <button
                            className="text-link muted"
                            disabled={
                              busy ||
                              data.claims.some(
                                (c: any) =>
                                  c.match_id === m.id &&
                                  !["Rejected", "Returned"].includes(c.status),
                              )
                            }
                            onClick={() =>
                              void act(
                                { action: "dismissMatch", id: m.id },
                                "Match dismissed.",
                              )
                            }
                          >
                            Dismiss Match
                          </button>
                        </div>
                      </section>
                    ))}
                  {!data.matches.some((m: any) => !m.dismissed) && (
                    <div className="panel staff-empty">
                      No potential matches. Compatible reports are compared
                      automatically.
                    </div>
                  )}
                </div>
              )}
              {section === "claims" && (
                <div className="staff-stack">
                  <label>
                    Claim queue
                    <select
                      value={claimFilter}
                      onChange={(e) => setClaimFilter(e.target.value)}
                    >
                      {[
                        "All",
                        "Action needed",
                        "Pending",
                        "More information",
                        "Approved",
                        "Rejected",
                        "Returned",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s === "More information"
                            ? "Awaiting claimant information"
                            : s}
                        </option>
                      ))}
                    </select>
                  </label>
                  {visibleClaims.map((c: any) => {
                    const m = data.matches.find(
                      (m: any) => m.id === c.match_id,
                    );
                    return (
                      <section className="panel staff-panel" key={c.id}>
                        <div className="staff-panel-title">
                          <h2>
                            {c.display_name} · {c.email}
                          </h2>
                          <span className="staff-pill">
                            {c.status === "More information"
                              ? "Awaiting claimant information"
                              : c.status}
                          </span>
                        </div>
                        <p className="staff-help">Claim reference: {c.id}</p>
                        <p className="staff-help">
                          Submitted {date(c.created_at)} · Updated{" "}
                          {date(c.updated_at)} · Ranking index {m?.score}/100
                        </p>
                        <StaffMatchAssessment reasoning={m?.staff_reasoning} />
                        {comparison(m)}
                        <div className="staff-evidence">
                          <span className="eyebrow">
                            PRIVATE VERIFICATION ANSWER
                          </span>
                          <p>{c.answers}</p>
                        </div>
                        {data.notes
                          .filter((n: any) => n.report_id === m?.lost_report_id)
                          .map((n: any) => (
                            <div className="staff-history" key={n.id}>
                              <small>
                                {n.from_staff
                                  ? "Staff message on this report"
                                  : "Claimant correspondence / previous answer"}
                                {" · "}
                                {date(n.created_at)}
                              </small>
                              <p>{n.body}</p>
                            </div>
                          ))}
                        {c.status === "More information" && (
                          <p className="staff-help">
                            Awaiting an updated answer. New claim evidence
                            returns this claim to Pending; review private
                            correspondence above as well.
                          </p>
                        )}
                        {["Pending", "More information"].includes(c.status) &&
                          !claimReviewable(c, m, data.reports) && (
                            <p className="staff-help">
                              This linked recovery is assigned, dismissed or
                              closed. No new claim decision is available; the
                              history is retained.
                            </p>
                          )}
                        {claimReviewable(c, m, data.reports) && (
                          <form
                            className="form-stack"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const d = new FormData(e.currentTarget);
                              if (
                                d.get("status") === "More information" &&
                                !String(d.get("message") || "").trim()
                              ) {
                                setError(
                                  "Enter a private request describing the information needed.",
                                );
                                return;
                              }
                              void act(
                                {
                                  action: "reviewClaim",
                                  id: c.id,
                                  status: d.get("status"),
                                  zoneId: d.get("zoneId"),
                                  message: d.get("message"),
                                },
                                "Claim decision saved.",
                              );
                            }}
                          >
                            <div className="staff-form-grid">
                              <label>
                                Decision
                                <select
                                  name="status"
                                  value={decisions[c.id] || "More information"}
                                  onChange={(e) =>
                                    setDecisions((old) => ({
                                      ...old,
                                      [c.id]: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="More information">
                                    Request More Information
                                  </option>
                                  <option value="Approved">
                                    Approve Claim
                                  </option>
                                  <option value="Rejected">Reject Claim</option>
                                </select>
                              </label>
                              <label>
                                Pickup location
                                <select
                                  name="zoneId"
                                  required={decisions[c.id] === "Approved"}
                                  disabled={
                                    (decisions[c.id] || "More information") !==
                                      "Approved" || busy
                                  }
                                >
                                  <option value="">Choose for approval</option>
                                  {zones.map((z: any) => (
                                    <option key={z.id} value={z.id}>
                                      {z.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <label>
                              {(decisions[c.id] || "More information") ===
                              "More information"
                                ? "Information requested (private, required)"
                                : "Private message to claimant (optional)"}
                              <textarea
                                name="message"
                                required={
                                  (decisions[c.id] || "More information") ===
                                  "More information"
                                }
                                disabled={busy}
                                rows={2}
                                maxLength={2000}
                                placeholder="Explain the next step without revealing the item’s identifying details."
                              />
                            </label>
                            <button className="button compact" disabled={busy}>
                              Save claim decision
                            </button>
                          </form>
                        )}
                      </section>
                    );
                  })}
                  {!visibleClaims.length && (
                    <div className="panel staff-empty">
                      {data.claims.length
                        ? "No claims match this queue."
                        : "No ownership claims have been submitted yet."}
                    </div>
                  )}
                </div>
              )}
              {section === "pickup" && (
                <>
                  <section className="panel staff-panel">
                    <h2>Confirm a pickup</h2>
                    <p className="staff-help">
                      Check the student’s identity and enter their private,
                      single-use code. Confirming marks the item Returned.
                    </p>
                    <form
                      className="staff-actions"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget,
                          code = String(new FormData(form).get("code"));
                        void act(
                          { action: "pickup", code },
                          "Pickup confirmed. Item returned.",
                        );
                      }}
                    >
                      <label>
                        Pickup code
                        <input
                          name="code"
                          required
                          minLength={12}
                          maxLength={12}
                          autoComplete="off"
                          placeholder="12-character code"
                        />
                      </label>
                      <button className="button compact" disabled={busy}>
                        Confirm return
                      </button>
                    </form>
                  </section>
                  <section className="panel staff-panel">
                    <h2>Pickup records</h2>
                    <p className="staff-help">
                      Deadlines are checked when this view refreshes and while
                      it is open. Only confirmed physical handover marks an item
                      Returned.
                    </p>
                    <label>
                      Pickup queue
                      <select
                        value={pickupFilter}
                        onChange={(e) => setPickupFilter(e.target.value)}
                      >
                        {[
                          "All",
                          "Action needed",
                          "Ready for Pickup",
                          "Returned",
                          "Closed",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    {visiblePickups.map((p: any) => {
                      const c = data.claims.find(
                        (c: any) => c.id === p.claim_id,
                      );
                      const m = c && recoveryFor(c);
                      return (
                        <PickupRecord
                          key={p.id}
                          pickup={p}
                          status={statusForPickup(p)}
                          itemName={
                            report(m?.found_report_id)?.name ||
                            "Recovery record"
                          }
                          claimant={c?.email || "Claimant unavailable"}
                          zones={zones}
                          busy={busy}
                          renew={async (id, zoneId) => {
                            const ok = await act(
                              { action: "reissuePickup", id, zoneId },
                              "Pickup pass renewed. The previous code is invalid.",
                            );
                            if (!ok)
                              throw new Error("Renewal could not be confirmed");
                          }}
                        />
                      );
                    })}
                    {!visiblePickups.length && (
                      <p className="staff-empty">
                        {data.pickups.length
                          ? "No pickups match this queue."
                          : "Approved claims will appear here."}
                      </p>
                    )}
                  </section>
                </>
              )}
              {section === "dropoffs" && (
                <>
                  <div className="staff-actions">
                    <button
                      className="button compact"
                      onClick={() => setZone({})}
                    >
                      Add drop-off zone
                      <MapPin size={16} />
                    </button>
                  </div>
                  {zone && (
                    <section className="panel staff-panel">
                      <h2>{zone.id ? "Edit" : "Add"} approved drop-off zone</h2>
                      <form
                        className="form-stack"
                        onSubmit={saveZone}
                        key={zone.id || "new"}
                      >
                        <div className="staff-form-grid">
                          <label>
                            Name
                            <input
                              name="name"
                              required
                              maxLength={150}
                              defaultValue={zone.name}
                            />
                          </label>
                          <label>
                            Building
                            <select
                              name="buildingId"
                              required
                              defaultValue={zone.building_id || ""}
                              onChange={(e) => {
                                const b = data.buildings.find(
                                  (b: any) => b.id === e.target.value,
                                );
                                if (b)
                                  setZone({
                                    ...zone,
                                    building_id: b.id,
                                    latitude: b.latitude,
                                    longitude: b.longitude,
                                  });
                              }}
                            >
                              <option value="">Select a campus building</option>
                              {data.buildings.map((b: any) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Latitude
                            <input
                              key={`lat-${zone.latitude}`}
                              name="lat"
                              type="number"
                              step="any"
                              min={-90}
                              max={90}
                              required
                              defaultValue={zone.latitude}
                            />
                          </label>
                          <label>
                            Longitude
                            <input
                              key={`lng-${zone.longitude}`}
                              name="lng"
                              type="number"
                              step="any"
                              min={-180}
                              max={180}
                              required
                              defaultValue={zone.longitude}
                            />
                          </label>
                        </div>
                        <label>
                          Staff instructions (not published)
                          <textarea
                            name="instructions"
                            maxLength={2000}
                            defaultValue={zone.instructions}
                            rows={3}
                          />
                        </label>
                        <label>
                          Public handover instructions
                          <textarea
                            name="publicInstructions"
                            required={zone.student_visible === true}
                            maxLength={2000}
                            rows={3}
                            defaultValue={zone.public_instructions || ""}
                            placeholder="Directions for handing an item to campus staff. Exclude storage rooms, access codes and staff-only details."
                          />
                        </label>
                        <label className="staff-checkbox">
                          <input
                            name="studentVisible"
                            type="checkbox"
                            checked={zone.student_visible === true}
                            onChange={(e) =>
                              setZone({
                                ...zone,
                                student_visible: e.target.checked,
                              })
                            }
                          />
                          Approve student handover and publish this zone's name,
                          public building and public instructions
                        </label>
                        <p className="staff-help">
                          Review the name and public instructions before
                          publishing. Existing staff instructions and exact zone
                          coordinates are excluded from the student directory.
                        </p>
                        <label className="staff-checkbox">
                          <input
                            name="active"
                            type="checkbox"
                            defaultChecked={zone.active ?? true}
                          />
                          Active intake location
                        </label>
                        <div className="staff-actions">
                          <button className="button compact" disabled={busy}>
                            Save zone
                          </button>
                          <button
                            type="button"
                            className="button secondary compact"
                            onClick={() => setZone(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    </section>
                  )}
                  <div className="staff-zone-grid">
                    {data.zones.map((z: any) => (
                      <section className="panel staff-panel" key={z.id}>
                        <div className="staff-panel-title">
                          <MapPin size={20} />
                          <span className="staff-pill">
                            {z.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <h2>{z.name}</h2>
                        <p>{z.building}</p>
                        <small>
                          Student directory:{" "}
                          {z.active && z.student_visible
                            ? "Published"
                            : "Hidden"}
                        </small>
                        <p className="staff-help">
                          {z.instructions || "No instructions added."}
                        </p>
                        <small>
                          {z.latitude}, {z.longitude}
                        </small>
                        <button
                          className="text-link"
                          onClick={() => setZone(z)}
                        >
                          Edit zone
                          <ArrowUpRight size={14} />
                        </button>
                      </section>
                    ))}
                  </div>
                  {!data.zones.length && (
                    <p className="staff-empty">
                      No approved drop-off zones. Buildings are not
                      automatically intake desks.
                    </p>
                  )}
                </>
              )}
              {reportId && !detail && (
                <p className="staff-empty">
                  Report not found in the authorized staff workspace.
                </p>
              )}
            </>
          )}
        </div>
      </main>
      {detail && (
        <div className="staff-modal-backdrop">
          <section
            className="staff-detail panel"
            role="dialog"
            aria-modal="true"
            aria-label="Private report detail"
            onKeyDown={(e) => {
              const close = () =>
                reportId ? router.push("/admin/reports/") : setSelected("");
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              }
              if (e.key === "Tab") {
                const nodes = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
                  ),
                );
                const first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                }
                if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="staff-panel-title">
              <span className="eyebrow">
                PRIVATE {detail.type.toUpperCase()} REPORT
              </span>
              <button
                autoFocus
                aria-label="Close report"
                className="icon-button"
                onClick={() =>
                  reportId ? router.push("/admin/reports/") : setSelected("")
                }
              >
                <X size={20} />
              </button>
            </div>
            <h1>{detail.name}</h1>
            <div className="staff-actions">
              <span className="staff-pill">{detail.status}</span>
              <span>{detail.category}</span>
            </div>
            <div className="staff-photo-grid">
              {detail.imagePaths.map((id: string, index: number) => (
                <PrivatePhoto
                  key={id}
                  url={`/api/images/${id}/?workspace=admin`}
                  index={index}
                />
              ))}
            </div>
            <dl className="staff-details">
              {Object.entries({
                Reporter: `${detail.reporterName} · ${detail.reporterEmail}`,
                Description: detail.description,
                "Private identifying details": [
                  detail.privateDetail,
                  ...Object.entries(detail.identifyingDetails || {})
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k}: ${v}`),
                ]
                  .filter(Boolean)
                  .join("\n"),
                Brand: detail.brand,
                Model: detail.model,
                Colors: [detail.color, detail.secondaryColor]
                  .filter(Boolean)
                  .join(", "),
                Location: detail.location,
                "Date / time": date(detail.date),
                "Received at": detail.receivedAt
                  ? date(detail.receivedAt)
                  : "—",
                "Intake zone":
                  data.zones.find((z: any) => z.id === detail.dropoffZoneId)
                    ?.name || "—",
                "Staff notes": detail.staffNotes || "—",
              }).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{String(v || "—")}</dd>
                </div>
              ))}
            </dl>
            {detail.type === "found" && (
              <form
                className="staff-actions"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act(
                    {
                      action: "custody",
                      id: detail.id,
                      status: new FormData(e.currentTarget).get("status"),
                    },
                    "Custody updated.",
                  );
                }}
              >
                <label>
                  Custody
                  <select name="status" defaultValue={detail.custodyStatus}>
                    {[
                      "Received",
                      "Stored",
                      "Potential Match",
                      "Claim Pending",
                      "Ready for Pickup",
                      "Returned",
                    ].map((s) => (
                      <option
                        key={s}
                        disabled={["Ready for Pickup", "Returned"].includes(s)}
                      >
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="button compact"
                  disabled={
                    busy ||
                    ["Ready for Pickup", "Returned"].includes(detail.status)
                  }
                >
                  Update custody
                </button>
              </form>
            )}
            <h2>Match & claim history</h2>
            {data.matches
              .filter((m: any) =>
                [m.lost_report_id, m.found_report_id].includes(detail.id),
              )
              .map((m: any) => (
                <div className="staff-history" key={m.id}>
                  <strong>
                    Ranking index {m.score}/100 ·{" "}
                    {m.dismissed ? "Dismissed" : "Potential match"}
                  </strong>
                  <StaffMatchAssessment reasoning={m?.staff_reasoning} />
                  <small>{date(m.created_at)}</small>
                  {data.claims
                    .filter((c: any) => c.match_id === m.id)
                    .map((c: any) => (
                      <p key={c.id}>
                        {c.email} · {c.status} · {date(c.created_at)}
                      </p>
                    ))}
                </div>
              ))}
            <h2>Private correspondence</h2>
            {data.notes
              .filter((n: any) => n.report_id === detail.id)
              .map((n: any) => (
                <div className="staff-history" key={n.id}>
                  <small>
                    {n.from_staff ? "Staff" : "Student"} · {date(n.created_at)}
                  </small>
                  <p>{n.body}</p>
                </div>
              ))}
            <p className="staff-help">
              Photographs and identifying details are visible to authorized
              staff only.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
