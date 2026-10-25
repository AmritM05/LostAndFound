"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Plus,
  MapPin,
  FileText,
  Inbox,
  ChevronRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  LockKeyhole,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  SlidersHorizontal,
  Package,
  ScanLine,
  BarChart3,
  LoaderCircle,
  Bell,
  MessageSquare,
  Check,
  RefreshCw,
} from "lucide-react";
import QRCode from "qrcode";
import Brand from "../Brand";
import CampusMap from "../CampusMap";
import BuildingSelector from "../BuildingSelector";
import ReportForm from "./ReportForm";
import DropoffZones from "./DropoffZones";
import StudentClaim from "./StudentClaim";
import StudentDropoffGuidance from "./StudentDropoffGuidance";
import { claimContext, claimStatusText } from "./studentExperience";
import EditLostReport from "./EditLostReport";
import { Badge, Empty, PrivacyNote, SectionTitle, dateLabel } from "./ui";
import { useWorkspace } from "./useWorkspace";
import { campus } from "../../lib/campus";
import { categories } from "../../lib/reportFields";
import { signOut } from "../../services/sessionService";
import { Claim, Item, Match, PublicReport, DropoffZone } from "../../lib/types";
import * as api from "../../services/workspaceService";
import PrivatePhoto from "../PrivatePhoto";
import DeleteReportAction from "../DeleteReportAction";
import { getPrivatePhotoUrls } from "../../services/storageService";
const studentNav = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "search", name: "Search", icon: Search },
  { id: "report", name: "Report a lost item", icon: Plus },
  { id: "map", name: "Campus map", icon: MapPin },
  { id: "reports", name: "My reports", icon: FileText },
  { id: "updates", name: "Magpie Updates", icon: Inbox },
];
const adminNav = [
  { id: "overview", name: "Overview", icon: LayoutDashboard },
  { id: "reports", name: "All reports", icon: FileText },
  { id: "found", name: "Receive found item", icon: Plus },
  { id: "matches", name: "Potential matches", icon: ScanLine },
  { id: "claims", name: "Ownership claims", icon: ShieldCheck },
  { id: "pickup", name: "Pickup", icon: Package },
  { id: "dropoffs", name: "Drop-off zones", icon: MapPin },
  { id: "statistics", name: "Statistics", icon: BarChart3 },
];
export default function Portal({
  section = "overview",
  adminPortal = false,
}: {
  section?: string;
  adminPortal?: boolean;
}) {
  const { user, state, messages, loading, error, refresh } =
    useWorkspace(adminPortal);
  const [menu, setMenu] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All categories"),
    [type, setType] = useState("All types"),
    [publicReports, setPublicReports] = useState<PublicReport[]>([]),
    [publicLoading, setPublicLoading] = useState(false),
    [publicError, setPublicError] = useState(""),
    [selectedItem, setSelectedItem] = useState<Item | null>(null),
    [selectedMatch, setSelectedMatch] = useState<Match | null>(null),
    [photos, setPhotos] = useState<string[]>([]),
    [photoError, setPhotoError] = useState(""),
    [photoLoading, setPhotoLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [actionError, setActionError] = useState(""),
    [pickup, setPickup] = useState(""),
    [pass, setPass] = useState<Claim | null>(null),
    [qr, setQr] = useState(""),
    [selectedReport, setSelectedReport] = useState("");
  const [mapBuildingId, setMapBuildingId] = useState("");
  const [zones, setZones] = useState<DropoffZone[]>([]),
    [searchCandidate, setSearchCandidate] = useState<PublicReport | null>(null),
    [editing, setEditing] = useState(false),
    [locationFilter, setLocationFilter] = useState("All locations"),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState("");
  useEffect(() => {
    api
      .listDropoffZones()
      .then(setZones)
      .catch(() => {});
  }, [section]);
  const router = useRouter();
  const nav = adminPortal
      ? user?.role === "admin"
        ? adminNav
        : []
      : studentNav,
    base = adminPortal ? "/admin" : "/student";
  const active = state.items.filter(
      (i) => !["Returned", "Archived"].includes(i.status),
    ),
    matches = state.matches.filter(
      (m) =>
        !m.dismissed &&
        !state.claims.some(
          (c) =>
            c.matchId === m.id && ["Rejected", "Returned"].includes(c.status),
        ),
    ),
    unread = state.notices.filter((n) => !n.read).length,
    claims = state.claims.filter((c) =>
      ["Pending", "More information"].includes(c.status),
    ),
    returned = state.items.filter((i) => i.status === "Returned");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (section !== "search") return;
    let cancelled = false;
    setPublicLoading(true);
    setPublicError("");
    api
      .searchPublicReports()
      .then((r) => {
        if (!cancelled) setPublicReports(r);
      })
      .catch((e) => {
        if (!cancelled) setPublicError(e.message);
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [section]);
  useEffect(() => {
    setEditing(false);
    if (!selectedItem) return;
    let cancelled = false;
    setPhotos([]);
    setPhotoError("");
    const paths =
      selectedItem.imagePaths || [selectedItem.imagePath].filter(Boolean);
    if (!paths.length) {
      setPhotoLoading(false);
      return;
    }
    setPhotoLoading(true);
    getPrivatePhotoUrls(paths)
      .then((urls) => {
        if (!cancelled) setPhotos(urls);
      })
      .catch((e) => {
        if (!cancelled) setPhotoError(e.message);
      })
      .finally(() => {
        if (!cancelled) setPhotoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedItem]);
  useEffect(() => {
    if (!selectedItem && !selectedMatch && !pass && !searchCandidate) return;
    setActionError("");
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedItem(null);
        setSelectedMatch(null);
        setPass(null);
        setSearchCandidate(null);
      }
    };
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>("[role=dialog]");
    const buttons = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
        ) || [],
      );
    buttons()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = buttons();
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [selectedItem, selectedMatch, pass, searchCandidate]);
  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true);
    setActionError("");
    try {
      await action();
      await refresh();
      setToast(success);
      return true;
    } catch (e) {
      setActionError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function showPass(c: Claim) {
    if (!c.code || c.status !== "Approved") {
      setToast("No current pickup pass is available. Contact campus staff.");
      return;
    }
    try {
      setQr(
        await QRCode.toDataURL(c.token || c.code || "", {
          width: 240,
          margin: 2,
          color: { dark: "#17191D", light: "#ffffff" },
        }),
      );
      setPass(c);
    } catch {
      setToast(
        "Could not create the QR code. Your pickup code is still available in Updates.",
      );
    }
  }
  function reportLink() {
    return user ? "/student/report" : "/login";
  }
  const visibleItems = state.items.filter(
    (i) =>
      (category === "All categories" || i.category === category) &&
      (type === "All types" || i.type === type.toLowerCase()) &&
      (i.name + " " + i.category + " " + i.location + " " + i.status)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const publicFiltered = publicReports.filter(
    (i) =>
      i.type === "found" &&
      (category === "All categories" || i.category === category) &&
      (locationFilter === "All locations" || i.location === locationFilter) &&
      (!dateFrom || i.date.slice(0, 10) >= dateFrom) &&
      (!dateTo || i.date.slice(0, 10) <= dateTo) &&
      (i.category + " " + i.location)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const itemFor = (m: Match) => state.items.find((i) => i.id === m.lostId);
  const claimFor = (m: Match) => state.claims.find((c) => c.matchId === m.id);
  const attentionClaims = state.claims.filter((c) => c.status === "More information");
  async function respondToClaim(matchId: string, answer: string) {
    await api.submitClaim(matchId, answer);
    await refresh();
  }
  const title = nav.find((n) => n.id === section)?.name || "Overview";
  function reportTable(items: Item[]) {
    return items.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Report type</th>
              <th>Location</th>
              <th>Reported</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  <button
                    className="table-title"
                    onClick={() => setSelectedItem(i)}
                  >
                    <span className="category-icon">
                      <FileText size={17} />
                    </span>
                    <span>
                      {i.name}
                      <small>{i.category}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <Badge tone={i.type === "lost" ? "blue" : "neutral"}>
                    {i.type === "lost" ? "Lost" : "Found"}
                  </Badge>
                </td>
                <td>{i.location || "Location unknown"}</td>
                <td>{dateLabel(i.date)}</td>
                <td>
                  <Badge
                    tone={
                      i.status === "Returned"
                        ? "success"
                        : i.status === "Potential Match"
                          ? "blue"
                          : "neutral"
                    }
                  >
                    {i.status === "Matching" ? "Active" : i.status}
                  </Badge>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`View ${i.name}`}
                    onClick={() => setSelectedItem(i)}
                  >
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty title={state.items.length ? "No reports match these filters" : "No reports yet"}>
        {state.items.length ? "Try changing your search or filters." : "Your submitted reports and their current status will appear here."}
      </Empty>
    );
  }
  function matchList() {
    return matches.length ? (
      <div className="match-list">
        {matches.map((m) => {
          const item = itemFor(m),
            claim = claimFor(m);
          return (
            <article className="match-row" key={m.id}>
              <span className="match-symbol">
                <ScanLine size={22} />
              </span>
              <div className="match-row-content">
                <div className="match-row-title">
                  <h3>{item?.name || "Possible item match"}</h3>
                  <Badge tone="blue">{m.score}% similarity</Badge>
                </div>
                <p>
                  A {item?.category.toLowerCase() || "reported item"} may match
                  your report. Photographs and identifying details remain
                  private.
                </p>
                <small>
                  {claim
                    ? `Claim ${claim.status.toLowerCase()}`
                    : m.score >= 90
                      ? "Very likely match"
                      : m.score >= 75
                        ? "Strong possible match"
                        : "Possible match"}
                </small>
              </div>
              <button
                className="button secondary compact"
                onClick={() => setSelectedMatch(m)}
              >
                Review
                <ArrowRight size={14} />
              </button>
            </article>
          );
        })}
      </div>
    ) : (
      <Empty title="No potential matches">
        No potential matches yet. Updates about your lost report will appear
        here.
      </Empty>
    );
  }
  return (
    <div className={`portal ${adminPortal ? "admin-portal" : ""}`}>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-label">
          {adminPortal ? "ADMIN PORTAL" : "STUDENT PORTAL"}
        </div>
        <nav
          aria-label={
            adminPortal ? "Administrator navigation" : "Student navigation"
          }
        >
          {nav.map((n) => (
            <Link
              key={n.id}
              href={`${base}/${n.id}`}
              onClick={() => setMenu(false)}
              aria-current={section === n.id ? "page" : undefined}
              className={section === n.id ? "active" : ""}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
              {n.id === "updates" && unread > 0 && <b>{unread}</b>}
              {n.id === "claims" && claims.length > 0 && <b>{claims.length}</b>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="campus-label">
            <span className="campus-dot" />
            <span>{campus.name}</span>
          </div>
          {user ? (
            <div className="account">
              <span className="avatar">
                {user.name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                <strong>{user.name}</strong>
                <small>{adminPortal ? "Administrator" : "Student"}</small>
              </span>
              <button
                aria-label="Sign out"
                className="icon-button"
                onClick={async () => {
                  try {
                    await signOut();
                    router.push("/login/");
                  } catch (error) {
                    setActionError((error as Error).message);
                  }
                }}
              >
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <Link className="button secondary" href="/login">
              Sign in
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="portal-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={20} />
            </button>
            <span className="mobile-only mobile-wordmark">Magpie</span>
            <span>{adminPortal ? "Administration" : "Student portal"}</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            {adminPortal ? (
              <span className="access-label">
                <ShieldCheck size={14} />
                Restricted access
              </span>
            ) : (
              <Link
                className="updates-link"
                href="/student/updates"
                aria-label={`Magpie Updates${unread ? `, ${unread} unread` : ""}`}
              >
                <Bell size={18} />
                {unread > 0 && <i />}
              </Link>
            )}
            {user ? (
              <span className="top-avatar">
                {user.name
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
              </span>
            ) : (
              <Link href="/login" className="text-link">
                Sign in
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </header>
        <main className="main-content">
          <div className="alert info demo-notice" role="note">
            Hackathon demo · Email ownership is not verified. Use sample
            information. Reports and photos are saved to the application.
          </div>
          {loading ? (
            <div className="loading-state" role="status">
              <LoaderCircle size={24} className="spin" />
              <p>Loading your workspace…</p>
            </div>
          ) : adminPortal && user?.role !== "admin" ? (
            <div className="access-panel">
              <span className="access-icon">
                <ShieldCheck size={29} />
              </span>
              <h1>Staff tools are not available yet</h1>
              <p>The staff portal will be added in a later update.</p>
              <Link
                className="button"
                href={user ? "/student/overview" : "/login"}
              >
                {user ? "Return to student portal" : "Student sign in"}
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="alert error" role="alert">
                  {error}
                  <button className="text-link" onClick={refresh}>
                    Try again
                    <RefreshCw size={13} />
                  </button>
                </div>
              )}
              {!adminPortal && attentionClaims.length > 0 && section !== "updates" && (
                <div className="alert info" role="status">
                  <span>{attentionClaims.length} ownership {attentionClaims.length === 1 ? "claim needs" : "claims need"} more information.</span>
                  <Link className="text-link" href="/student/updates#ownership-claims">Review private requests</Link>
                </div>
              )}
              {!adminPortal && section === "overview" && <StudentDropoffGuidance compact />}
              {section === "overview" && (
                <>
                  <SectionTitle
                    title={adminPortal ? "Admin overview" : "Overview"}
                    description={
                      adminPortal
                        ? "Manage campus reports, ownership verification, and item returns."
                        : "Your lost reports and Magpie updates in one place."
                    }
                    action={
                      <Link
                        className="button"
                        href={adminPortal ? "/admin/found" : reportLink()}
                      >
                        <Plus size={16} />
                        {adminPortal ? "Receive found item" : "New lost report"}
                      </Link>
                    }
                  />
                  <div className={`stats-grid ${adminPortal ? "four" : ""}`}>
                    {(adminPortal
                      ? [
                          {
                            label: "Active reports",
                            value: active.length,
                            icon: FileText,
                            to: "/admin/reports",
                          },
                          {
                            label: "Pending claims",
                            value: claims.length,
                            icon: ShieldCheck,
                            to: "/admin/claims",
                          },
                          {
                            label: "Ready for pickup",
                            value: state.claims.filter(
                              (c) => c.status === "Approved",
                            ).length,
                            icon: Package,
                            to: "/admin/pickup",
                          },
                          {
                            label: "Returned items",
                            value: returned.filter((i) => i.type === "found")
                              .length,
                            icon: CheckCircle2,
                            to: "/admin/statistics",
                          },
                        ]
                      : [
                          {
                            label: "Active reports",
                            value: active.length,
                            icon: FileText,
                            to: "/student/reports",
                          },
                          {
                            label: "Potential matches",
                            value: matches.length,
                            icon: ScanLine,
                            to: "/student/updates",
                          },
                          {
                            label: "Recovered items",
                            value: returned.filter((i) => i.type === "lost")
                              .length,
                            icon: CheckCircle2,
                            to: "/student/reports",
                          },
                        ]
                    ).map((s) => (
                      <Link className="stat-card" href={s.to} key={s.label}>
                        <div>
                          <span>{s.label}</span>
                          <s.icon size={18} />
                        </div>
                        <strong>{s.value}</strong>
                        <small>
                          {s.label === "Potential matches"
                            ? "Private updates only"
                            : s.label === "Active reports"
                              ? "Currently unresolved"
                              : "View details"}
                          <ArrowUpRight size={13} />
                        </small>
                      </Link>
                    ))}
                  </div>
                  {!adminPortal && (
                    <section className="report-callout">
                      <span className="callout-icon">
                        <Search size={21} />
                      </span>
                      <div>
                        <h2>Lost something? Save the details.</h2>
                        <p>Keep a record of your lost item in Magpie.</p>
                      </div>
                      <Link className="button secondary" href={reportLink()}>
                        Report lost item
                        <ArrowRight size={15} />
                      </Link>
                    </section>
                  )}
                  <section className="panel overview-reports">
                    <div className="section-header">
                      <div>
                        <h2>
                          {adminPortal ? "Recent reports" : "Active reports"}
                        </h2>
                        <p>
                          {adminPortal
                            ? "Latest reports submitted across campus."
                            : "Track the status of your lost items."}
                        </p>
                      </div>
                      <Link className="text-link" href={`${base}/reports`}>
                        View all
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                    {reportTable(
                      (adminPortal ? state.items : active).slice(0, 4),
                    )}
                  </section>
                  <section className="panel overview-updates">
                    <div className="section-header">
                      <div>
                        <h2>
                          {adminPortal
                            ? "Claims awaiting review"
                            : "Recent updates"}
                        </h2>
                        <p>
                          {adminPortal
                            ? "Resolve ownership requests securely."
                            : "Updates about reports saved in Magpie."}
                        </p>
                      </div>
                      <Link
                        className="text-link"
                        href={
                          adminPortal ? "/admin/claims" : "/student/updates"
                        }
                      >
                        View all
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                    {adminPortal ? (
                      claims.length ? (
                        <div className="compact-list">
                          {claims.slice(0, 3).map((c) => (
                            <Link key={c.id} href="/admin/claims">
                              <span>
                                <strong>
                                  {state.items.find(
                                    (i) =>
                                      i.id ===
                                      state.matches.find(
                                        (m) => m.id === c.matchId,
                                      )?.lostId,
                                  )?.name || "Ownership claim"}
                                </strong>
                                <small>Awaiting staff review</small>
                              </span>
                              <ChevronRight size={17} />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="inline-empty">No pending claims.</div>
                      )
                    ) : state.notices.length ? (
                      <div className="compact-list">
                        {state.notices.slice(0, 3).map((n) => (
                          <Link key={n.id} href="/student/updates">
                            <span
                              className={`update-dot ${n.read ? "read" : ""}`}
                            />
                            <span>
                              <strong>{n.title}</strong>
                              <small>{n.message}</small>
                            </span>
                            <ChevronRight size={16} />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="inline-empty">
                        <LockKeyhole size={17} />
                        <span>
                          No updates yet. Saved report activity will appear
                          here.
                        </span>
                      </div>
                    )}
                  </section>
                  <PrivacyNote />
                </>
              )}
              {section === "search" && (
                <>
                  <SectionTitle
                    title="Search campus items"
                    description="Browse limited summaries. Item photos and identifying details are always private."
                  />
                  <div className="panel search-panel">
                    <div className="search-toolbar">
                      <label className="search-input">
                        <Search size={18} />
                        <input
                          placeholder="Search by category or campus location"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filter by category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option>All categories</option>
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter by general location"
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                      >
                        <option>All locations</option>
                        {[...new Set(publicReports.map((r) => r.location))]
                          .sort()
                          .map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                      </select>
                    </div>
                    <div className="safe-search-filters">
                      <label>
                        From date
                        <input
                          type="date"
                          aria-label="From date"
                          value={dateFrom}
                          max={dateTo || undefined}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </label>
                      <label>
                        To date
                        <input
                          type="date"
                          aria-label="To date"
                          value={dateTo}
                          min={dateFrom || undefined}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="search-summary">
                      <span>
                        {publicFiltered.length}{" "}
                        {publicFiltered.length === 1 ? "report" : "reports"}
                      </span>
                      <span>
                        <LockKeyhole size={12} />
                        Public summaries only
                      </span>
                    </div>
                    {publicError && (
                      <div className="alert error">{publicError}</div>
                    )}
                    {publicLoading ? (
                      <div className="loading-state">
                        <LoaderCircle size={22} className="spin" />
                        Loading reports…
                      </div>
                    ) : publicFiltered.length ? (
                      <div className="public-grid">
                        {publicFiltered.map((r) => (
                          <article className="public-card" key={r.id}>
                            <div>
                              <span className="category-icon">
                                <Package size={19} />
                              </span>
                              <Badge
                                tone={r.type === "lost" ? "blue" : "neutral"}
                              >
                                {r.type === "lost" ? "Lost" : "Found"}
                              </Badge>
                            </div>
                            <h2>{r.category}</h2>
                            <p>
                              <MapPin size={14} />
                              {r.location}
                            </p>
                            <p>
                              <FileText size={14} />
                              Reported {dateLabel(r.date)}
                            </p>
                            <small>
                              Photos and identifying details withheld
                            </small>
                            <button
                              className="text-link"
                              onClick={() => setSearchCandidate(r)}
                            >
                              This might be mine
                              <ArrowRight size={14} />
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title={
                          query ||
                          category !== "All categories" ||
                          type !== "All types" || locationFilter !== "All locations" || dateFrom || dateTo
                            ? "No matching summaries"
                            : "No public reports available"
                        }
                      >
                        {publicReports.length ? "Try changing your search, category, location, or date filters." : "No found-item summaries are available yet. You can save and review your own lost reports in My Reports."}
                      </Empty>
                    )}
                  </div>
                  <PrivacyNote>
                    Public search never includes photographs, names, brands,
                    private descriptions, serial fragments, claimant details, or
                    correspondence.
                  </PrivacyNote>
                </>
              )}
              {(section === "report" ||
                (adminPortal && section === "found")) && (
                <>
                  <SectionTitle
                    title={
                      adminPortal
                        ? "Receive a found item"
                        : "Report a Lost Item"
                    }
                    description={
                      adminPortal
                        ? "Record an item received by authorized staff at an approved drop-off zone."
                        : "Describe the item you lost. Its location is optional."
                    }
                  />
                  {!user && (
                    <div className="alert info">
                      <span>Sign in to submit and save a report.</span>
                      <Link href="/login" className="text-link">
                        Sign in
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  )}
                  {!adminPortal && <StudentDropoffGuidance compact />}
                  <ReportForm
                    mode={adminPortal ? "found" : "lost"}
                    zones={zones}
                    user={user}
                    onSubmit={async (item, details, files, progress) => {
                      await api.createReport(item, details, files, progress);
                      await refresh();
                    }}
                  />
                </>
              )}
              {adminPortal && section === "dropoffs" && <DropoffZones />}
              {section === "reports" && (
                <>
                  <SectionTitle
                    title={adminPortal ? "All reports" : "My reports"}
                    description={
                      adminPortal
                        ? "Review private report details and manage item statuses."
                        : "Manage reports saved in Magpie."
                    }
                    action={
                      !adminPortal ? (
                        <Link className="button" href={reportLink()}>
                          <Plus size={16} />
                          New report
                        </Link>
                      ) : undefined
                    }
                  />
                  <section className="panel">
                    <div className="search-toolbar">
                      <label className="search-input">
                        <Search size={17} />
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search your reports"
                        />
                      </label>
                      <select
                        aria-label="Filter reports by category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option>All categories</option>
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      {adminPortal && (
                        <select
                          aria-label="Filter reports by type"
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                        >
                          <option>All types</option>
                          <option>Lost</option>
                          <option>Found</option>
                        </select>
                      )}
                    </div>
                    {reportTable(visibleItems)}
                  </section>
                  <PrivacyNote />
                </>
              )}
              {section === "updates" && (
                <>
                  <SectionTitle
                    title="Magpie Updates"
                    description="Private matches, report updates, and correspondence with your campus team."
                    action={
                      unread > 0 ? (
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() =>
                            perform(
                              api.markUpdatesRead,
                              "Updates marked as read.",
                            )
                          }
                        >
                          <Check size={15} />
                          Mark all read
                        </button>
                      ) : undefined
                    }
                  />
                  {!adminPortal && <button className="button secondary compact" onClick={refresh}>Refresh claim status</button>}
                  {!adminPortal && <section id="ownership-claims" aria-label="Your ownership claims">
                    <h2>Your ownership claims</h2>
                    {!user ? <Empty title="Sign in to view your claims" action={<Link className="button secondary" href="/login">Sign in</Link>}>Your ownership requests and responses are private.</Empty> : state.claims.length ? state.claims.map((claim) => <StudentClaim
                      key={claim.id} claim={claim} report={claimContext(state, claim)}
                      messages={messages} submit={respondToClaim} showPass={showPass} />)
                      : <Empty title="No ownership claims yet">Review a potential match to submit a private ownership claim.</Empty>}
                  </section>}
                  <div className="updates-layout">
                    <div>
                      <section className="panel">
                        <div className="section-header">
                          <div>
                            <h2>Potential matches</h2>
                            <p>
                              Review possible matches without exposing another
                              student’s private report.
                            </p>
                          </div>
                          <Badge tone="blue">{matches.length}</Badge>
                        </div>
                        {matchList()}
                      </section>
                      <section className="panel">
                        <div className="section-header">
                          <h2>Report updates</h2>
                        </div>
                        {state.notices.length ? (
                          <div className="notification-list">
                            {state.notices.map((n) => (
                              <article key={n.id}>
                                <span
                                  className={`update-dot ${n.read ? "read" : ""}`}
                                />
                                <div>
                                  <h3>{n.title}</h3>
                                  <p>{n.message}</p>
                                  {n.createdAt && (
                                    <time>{dateLabel(n.createdAt)}</time>
                                  )}
                                </div>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <Empty title="No private updates">
                            Updates about your reports and claims will appear
                            here.
                          </Empty>
                        )}
                      </section>
                    </div>
                    <section className="panel correspondence-panel">
                      <div className="section-header">
                        <div>
                          <h2>Report notes</h2>
                          <p>Notes saved with your report. To answer an ownership information request, use Your ownership claims above.</p>
                        </div>
                        <LockKeyhole size={16} />
                      </div>
                      <label>
                        Choose a report
                        <select
                          value={selectedReport}
                          onChange={(e) => setSelectedReport(e.target.value)}
                        >
                          <option value="">Select your report</option>
                          {state.items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {selectedReport ? (
                        <>
                          <div className="message-list">
                            {messages.filter(
                              (m) => m.reportId === selectedReport,
                            ).length ? (
                              messages
                                .filter((m) => m.reportId === selectedReport)
                                .map((m) => (
                                  <article
                                    className={
                                      m.fromStaff
                                        ? "staff-message"
                                        : "student-message"
                                    }
                                    key={m.id}
                                  >
                                    <strong>
                                      {m.fromStaff
                                        ? "Magpie campus team"
                                        : "You"}
                                    </strong>
                                    <p>{m.body}</p>
                                    <time>{dateLabel(m.createdAt)}</time>
                                  </article>
                                ))
                            ) : (
                              <div className="inline-empty">
                                No notes on this report yet.
                              </div>
                            )}
                          </div>
                          <form
                            className="form-stack message-form"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const form = e.currentTarget;
                              const body = String(
                                new FormData(form).get("message"),
                              ).trim();
                              const sent = await perform(
                                () => api.sendMessage(selectedReport, body),
                                "Note saved in Magpie.",
                              );
                              if (sent) form.reset();
                            }}
                          >
                            <label>
                              Note for this report
                              <textarea
                                name="message"
                                required
                                minLength={3}
                                maxLength={2000}
                                rows={3}
                                placeholder="Ask about your report or provide additional details."
                              />
                            </label>
                            <button className="button compact" disabled={busy}>
                              Save note
                              <ArrowRight size={14} />
                            </button>
                          </form>
                        </>
                      ) : (
                        <div className="inline-empty">
                          Select a report to view its notes.
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
              {section === "map" && (
                <>
                  <SectionTitle
                    title="Campus map"
                    description="Find campus buildings and read guidance for handing found items to authorized staff."
                  />
                  <section className="panel map-panel">
                    <div className="section-header">
                      <BuildingSelector
                        label="Find a campus building"
                        value={mapBuildingId}
                        onChange={(b) => setMapBuildingId(b?.id || "")}
                      />
                    </div>
                    <CampusMap
                      value={campus.locations.find(
                        (l) => l.id === mapBuildingId,
                      )}
                    />
                    <div className="map-bottom">
                      <span>
                        <MapPin size={15} />
                        {campus.name}
                      </span>
                      <span>
                        Item locations and photographs are not displayed
                        publicly.
                      </span>
                    </div>
                  </section>
                  <StudentDropoffGuidance />
                </>
              )}
              {adminPortal && section === "matches" && (
                <>
                  <SectionTitle
                    title="Potential matches"
                    description="Review similarities between private lost and found reports."
                  />
                  <section className="panel">{matchList()}</section>
                </>
              )}
              {adminPortal && section === "claims" && (
                <>
                  <SectionTitle
                    title="Ownership claims"
                    description="Compare private evidence before approving ownership or arranging pickup."
                  />
                  {state.claims.length ? (
                    state.claims.map((c) => {
                      const m = state.matches.find((m) => m.id === c.matchId),
                        l = state.items.find((i) => i.id === m?.lostId),
                        f = state.items.find((i) => i.id === m?.foundId);
                      return (
                        <section className="panel claim-panel" key={c.id}>
                          <div className="section-header">
                            <div>
                              <h2>{l?.name || "Ownership claim"}</h2>
                              <p>
                                Claim reference {c.id.slice(0, 8).toUpperCase()}{" "}
                                · Match similarity {m?.score}%
                              </p>
                            </div>
                            <Badge
                              tone={
                                c.status === "Approved" ? "success" : "blue"
                              }
                            >
                              {c.status}
                            </Badge>
                          </div>
                          <div className="claim-comparison">
                            {[l, f].map((item, i) => (
                              <div key={i}>
                                <span className="eyebrow">
                                  {i === 0 ? "LOST REPORT" : "FOUND REPORT"}
                                </span>
                                <h3>{item?.name || "Unavailable"}</h3>
                                <p>{item?.location}</p>
                                <p>
                                  {item?.description ||
                                    "No description provided."}
                                </p>
                                {item && (
                                  <button
                                    className="text-link"
                                    onClick={() => setSelectedItem(item)}
                                  >
                                    View private report & photos
                                    <ArrowRight size={13} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="claim-evidence">
                            <div>
                              <span>Submitted ownership evidence</span>
                              <p>{c.answers}</p>
                            </div>
                            <div>
                              <span>Original private report details</span>
                              <p>
                                {(l && state.privateDetails[l.id]) ||
                                  "No identifying details supplied."}
                              </p>
                            </div>
                          </div>
                          {["Pending", "More information"].includes(
                            c.status,
                          ) ? (
                            <form
                              className="claim-review-form"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const d = new FormData(e.currentTarget);
                                perform(
                                  () =>
                                    api.reviewClaim(
                                      c.id,
                                      String(
                                        d.get("decision"),
                                      ) as Claim["status"],
                                      String(d.get("location")),
                                      String(d.get("message")),
                                    ),
                                  "Claim decision saved and sent privately.",
                                );
                              }}
                            >
                              <div className="field-pair">
                                <label>
                                  Decision
                                  <select name="decision" required>
                                    <option value="More information">
                                      Request more information
                                    </option>
                                    <option value="Approved">
                                      Approve claim & prepare pickup
                                    </option>
                                    <option value="Rejected">
                                      Reject claim
                                    </option>
                                  </select>
                                </label>
                                <label>
                                  Pickup location
                                  <input
                                    name="location"
                                    defaultValue={campus.pickupName}
                                    required
                                    maxLength={150}
                                  />
                                </label>
                              </div>
                              <label>
                                Private message to claimant
                                <textarea
                                  name="message"
                                  required
                                  minLength={3}
                                  maxLength={2000}
                                  rows={2}
                                  placeholder="Explain the decision or ask for a specific identifying detail."
                                />
                              </label>
                              <button
                                className="button compact"
                                disabled={busy}
                              >
                                Save decision
                                <Check size={15} />
                              </button>
                            </form>
                          ) : c.status === "Approved" ? (
                            <button
                              className="button secondary compact"
                              onClick={() => showPass(c)}
                            >
                              View pickup pass
                              <ScanLine size={15} />
                            </button>
                          ) : null}
                        </section>
                      );
                    })
                  ) : (
                    <section className="panel">
                      <Empty title="No ownership claims">
                        Claims appear here when a student submits private
                        verification for a possible match.
                      </Empty>
                    </section>
                  )}
                </>
              )}
              {adminPortal && section === "pickup" && (
                <>
                  <SectionTitle
                    title="Secure pickup"
                    description="Verify the student’s identity, then redeem their single-use pickup pass."
                  />
                  <section className="panel pickup-panel">
                    <ScanLine size={29} />
                    <h2>Confirm an item return</h2>
                    <p>
                      Enter the pickup code or the value from a scanned QR code.
                    </p>
                    <form
                      className="form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        perform(async () => {
                          await api.confirmPickup(pickup);
                          setPickup("");
                        }, "Pickup confirmed. The item is marked returned.");
                      }}
                    >
                      <label>
                        Pickup code
                        <input
                          required
                          value={pickup}
                          onChange={(e) => setPickup(e.target.value)}
                          placeholder="MAGPIE-XXXXXXXXXXXX"
                          autoComplete="off"
                        />
                      </label>
                      <button className="button" disabled={busy}>
                        Confirm pickup
                        <CheckCircle2 size={16} />
                      </button>
                    </form>
                  </section>
                  <section className="panel">
                    <div className="section-header">
                      <h2>Ready for pickup</h2>
                    </div>
                    {state.claims.some((c) => c.status === "Approved") ? (
                      <div className="compact-list">
                        {state.claims
                          .filter((c) => c.status === "Approved")
                          .map((c) => (
                            <button key={c.id} onClick={() => showPass(c)}>
                              <span>
                                <strong>
                                  {state.items.find(
                                    (i) =>
                                      i.id ===
                                      state.matches.find(
                                        (m) => m.id === c.matchId,
                                      )?.lostId,
                                  )?.name || "Approved claim"}
                                </strong>
                                <small>{c.pickupLocation}</small>
                              </span>
                              <span className="text-link">
                                View pass
                                <ChevronRight size={14} />
                              </span>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <div className="inline-empty">
                        No items are awaiting pickup.
                      </div>
                    )}
                  </section>
                </>
              )}
              {adminPortal && section === "statistics" && (
                <>
                  <SectionTitle
                    title="Reporting statistics"
                    description="Summary of actual reports and completed returns."
                  />
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span>Total reports</span>
                      <strong>{state.items.length}</strong>
                    </div>
                    <div className="stat-card">
                      <span>Returned found items</span>
                      <strong>
                        {returned.filter((i) => i.type === "found").length}
                      </strong>
                    </div>
                    <div className="stat-card">
                      <span>Match suggestions</span>
                      <strong>{state.matches.length}</strong>
                    </div>
                  </div>
                  <section className="panel">
                    <div className="section-header">
                      <h2>Reports by category</h2>
                    </div>
                    {state.items.length ? (
                      <div className="chart">
                        {categories
                          .filter((c) =>
                            state.items.some((i) => i.category === c),
                          )
                          .map((c) => (
                            <div className="chart-row" key={c}>
                              <span>{c}</span>
                              <div>
                                <i
                                  style={{
                                    width: `${(state.items.filter((i) => i.category === c).length / state.items.length) * 100}%`,
                                  }}
                                />
                              </div>
                              <strong>
                                {
                                  state.items.filter((i) => i.category === c)
                                    .length
                                }
                              </strong>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <Empty title="No reporting data">
                        Statistics are calculated from submitted reports. No
                        sample results are displayed.
                      </Empty>
                    )}
                  </section>
                </>
              )}
              {!user &&
                !adminPortal &&
                section !== "report" &&
                section !== "search" &&
                section !== "map" && (
                  <div className="signin-strip">
                    <LockKeyhole size={16} />
                    <p>Sign in to view your private reports and updates.</p>
                    <Link href="/login" className="text-link">
                      Sign in
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              {actionError && (
                <div className="alert error" role="alert">
                  {actionError}
                </div>
              )}
              <footer className="portal-footer">
                <span>Magpie · Campus lost & found</span>
                <span>
                  <LockKeyhole size={12} />
                  Student portal
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {searchCandidate && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Connect a lost report"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close search match"
              onClick={() => setSearchCandidate(null)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">PRIVATE OWNERSHIP CHECK</span>
            <h2>This might be mine</h2>
            <p>
              Item photographs and identifying details will not be revealed.
              Magpie needs your own description before it can help verify
              ownership.
            </p>
            {!user ? (
              <Link className="button" href="/login">
                Sign in to continue
                <ArrowRight size={15} />
              </Link>
            ) : state.items.some(
                (i) =>
                  i.type === "lost" &&
                  i.category === searchCandidate.category &&
                  !["Returned", "Archived"].includes(i.status),
              ) ? (
              <div className="search-report-options">
                <p>Choose your compatible lost report:</p>
                {state.items
                  .filter(
                    (i) =>
                      i.type === "lost" &&
                      i.category === searchCandidate.category &&
                      !["Returned", "Archived"].includes(i.status),
                  )
                  .map((i) => (
                    <button
                      className="button secondary"
                      disabled={busy}
                      key={i.id}
                      onClick={() =>
                        perform(async () => {
                          const m = await api.connectSearchReport(
                            searchCandidate.id,
                            i.id,
                          );
                          await refresh();
                          setSelectedMatch(m);
                          setSearchCandidate(null);
                        }, "Connected privately to your lost report.")
                      }
                    >
                      {i.name}
                      <ArrowRight size={14} />
                    </button>
                  ))}
              </div>
            ) : (
              <>
                <p>
                  Before we can verify ownership, please report the item you
                  lost.
                </p>
                <Link className="button" href="/student/report">
                  Report a Lost Item
                  <ArrowRight size={15} />
                </Link>
              </>
            )}
            {actionError && (
              <div className="alert error" role="alert">
                {actionError}
              </div>
            )}
          </section>
        </div>
      )}
      {(selectedItem || selectedMatch || pass) && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedItem(null);
              setSelectedMatch(null);
              setPass(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={
              selectedItem
                ? "Private report"
                : pass
                  ? "Pickup pass"
                  : "Private match review"
            }
            className="modal"
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => {
                setSelectedItem(null);
                setSelectedMatch(null);
                setPass(null);
              }}
            >
              <X size={20} />
            </button>
            {selectedItem && (
              <>
                <span className="eyebrow">PRIVATE REPORT</span>
                <h2>{selectedItem.name}</h2>
                <div className="detail-badges">
                  <Badge tone="blue">{selectedItem.type}</Badge>
                  <Badge>
                    {selectedItem.status === "Matching"
                      ? "Active"
                      : selectedItem.status}
                  </Badge>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Category</dt>
                    <dd>{selectedItem.category}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{selectedItem.location || "Location unknown"}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{dateLabel(selectedItem.date)}</dd>
                  </div>
                  {selectedItem.brand && (
                    <div>
                      <dt>Brand / model</dt>
                      <dd>
                        {selectedItem.brand} {selectedItem.model}
                      </dd>
                    </div>
                  )}
                  {selectedItem.size && (
                    <div>
                      <dt>Size</dt>
                      <dd>{selectedItem.size}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Color / appearance</dt>
                    <dd>
                      {[selectedItem.color, selectedItem.secondaryColor]
                        .filter(Boolean)
                        .join(" / ")}
                    </dd>
                  </div>
                </dl>
                {!adminPortal &&
                  selectedItem.type === "lost" &&
                  ![
                    "Awaiting Verification",
                    "Ready for Pickup",
                    "Returned",
                    "Archived",
                  ].includes(selectedItem.status) && (
                    <button
                      className="button secondary compact"
                      onClick={() => setEditing(!editing)}
                    >
                      Edit lost report
                    </button>
                  )}
                {!adminPortal &&
                  selectedItem.type === "lost" &&
                  selectedItem.reporterId === user?.id && (
                    <DeleteReportAction
                      key={selectedItem.id}
                      reportId={selectedItem.id}
                      blocked={
                        !!state.items.find(
                          (item) => item.id === selectedItem.id,
                        )?.deletionBlocked
                      }
                      onDeleted={() => {
                        setSelectedItem(null);
                        setEditing(false);
                        setSelectedMatch(null);
                        setToast("Report deleted.");
                        void refresh();
                      }}
                    />
                  )}
                {editing && !adminPortal && (
                  <EditLostReport
                    item={selectedItem}
                    details={state.privateDetails[selectedItem.id] || ""}
                    onCancel={() => setEditing(false)}
                    onSaved={() => {
                      setEditing(false);
                      setSelectedItem(null);
                      refresh();
                      setToast("Your report was updated in Magpie.");
                    }}
                  />
                )}
                {adminPortal && selectedItem.type === "found" && (
                  <>
                    <h3>Staff intake & custody</h3>
                    <p>
                      Entered by authorized staff · Received{" "}
                      {selectedItem.receivedAt
                        ? new Date(selectedItem.receivedAt).toLocaleString()
                        : "Previously recorded"}
                    </p>
                    <p>
                      Drop-off zone:{" "}
                      {zones.find((z) => z.id === selectedItem.dropoffZoneId)
                        ?.name || "Legacy inventory"}
                    </p>
                    <p>Custody: {selectedItem.custodyStatus || "Received"}</p>
                    <p>
                      Staff notes: {selectedItem.staffNotes || "None supplied."}
                    </p>
                    {!["Ready for Pickup", "Returned"].includes(
                      selectedItem.status,
                    ) && (
                      <label>
                        Update custody
                        <select
                          value={selectedItem.custodyStatus || "Received"}
                          disabled={busy}
                          onChange={(e) =>
                            perform(async () => {
                              await api.updateCustody(
                                selectedItem.id,
                                e.target.value,
                              );
                              setSelectedItem({
                                ...selectedItem,
                                custodyStatus: e.target
                                  .value as Item["custodyStatus"],
                              });
                            }, "Custody status updated.")
                          }
                        >
                          <option>Received</option>
                          <option>Stored</option>
                        </select>
                      </label>
                    )}
                  </>
                )}
                <h3>Private description</h3>
                <p>{selectedItem.description || "No description supplied."}</p>
                <h3>Ownership details</h3>
                <p>
                  {state.privateDetails[selectedItem.id] ||
                    "No additional identifying details."}
                </p>
                <h3>Private photographs</h3>
                {photoLoading ? (
                  <p>
                    <LoaderCircle size={16} className="spin" />
                    Loading authorized photographs…
                  </p>
                ) : photoError ? (
                  <div className="alert error">{photoError}</div>
                ) : photos.length ? (
                  <div className="private-photo-grid">
                    {photos.map((p, i) => (
                      <PrivatePhoto key={p} url={p} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="no-photo">
                    <LockKeyhole size={17} />
                    No photographs were uploaded.
                  </div>
                )}
                {adminPortal &&
                  !["Ready for Pickup", "Returned"].includes(
                    selectedItem.status,
                  ) && (
                    <form
                      className="form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const status = String(
                          new FormData(e.currentTarget).get("status"),
                        ) as Item["status"];
                        perform(
                          () => api.updateReportStatus(selectedItem.id, status),
                          "Report status updated.",
                        );
                        setSelectedItem(null);
                      }}
                    >
                      <label>
                        Report status
                        <select
                          name="status"
                          defaultValue={selectedItem.status}
                        >
                          {["Matching", "Secured", "Archived"].map((s) => (
                            <option value={s} key={s}>
                              {s === "Matching" ? "Active" : s}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className="button compact" disabled={busy}>
                        Update status
                      </button>
                    </form>
                  )}
                {adminPortal && (
                  <div className="admin-correspondence">
                    <h3>Private correspondence</h3>
                    <div className="message-list">
                      {messages
                        .filter((m) => m.reportId === selectedItem.id)
                        .map((m) => (
                          <article
                            key={m.id}
                            className={
                              m.fromStaff ? "staff-message" : "student-message"
                            }
                          >
                            <strong>
                              {m.fromStaff ? "Campus staff" : "Reporter"}
                            </strong>
                            <p>{m.body}</p>
                          </article>
                        ))}
                    </div>
                    <form
                      className="form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        perform(async () => {
                          await api.sendMessage(
                            selectedItem.id,
                            String(new FormData(form).get("message")),
                          );
                          form.reset();
                        }, "Private reply sent.");
                      }}
                    >
                      <label>
                        Reply to reporter
                        <textarea
                          name="message"
                          required
                          minLength={3}
                          maxLength={2000}
                          rows={3}
                        />
                      </label>
                      <button className="button compact" disabled={busy}>
                        Send private reply
                      </button>
                    </form>
                  </div>
                )}
                <PrivacyNote />
              </>
            )}
            {!selectedItem && selectedMatch && (
              <>
                <span className="eyebrow">PRIVATE MATCH REVIEW</span>
                <h2>{itemFor(selectedMatch)?.name || "Possible match"}</h2>
                <p>
                  Magpie found a similar report. The other report’s photographs
                  and identifying details are withheld so ownership can be
                  verified privately.
                </p>
                <div className="match-confidence">
                  <strong>{selectedMatch.score}%</strong>
                  <span>
                    Similarity estimate
                    <br />
                    <small>A possible match, not proof of ownership.</small>
                  </span>
                </div>
                <div className="factor-list">
                  {Object.entries(selectedMatch.factors).map(
                    ([name, value]) => (
                      <div key={name}>
                        <span>{name}</span>
                        <div>
                          <i style={{ width: `${value}%` }} />
                        </div>
                        <strong>{value}%</strong>
                      </div>
                    ),
                  )}
                </div>
                {claimFor(selectedMatch) ? (
                  <div className="claim-status">
                    <Badge tone="blue">{claimFor(selectedMatch)!.status}</Badge>
                    <p>
                      {claimStatusText(claimFor(selectedMatch)!)}
                    </p>
                    {!adminPortal && claimFor(selectedMatch)!.status === "More information" && (
                      <Link className="button secondary" href={`/student/updates#claim-${claimFor(selectedMatch)!.id}`} onClick={() => setSelectedMatch(null)}>Respond privately</Link>
                    )}
                    {claimFor(selectedMatch)!.status === "Approved" && claimFor(selectedMatch)!.code && (
                      <button
                        className="button"
                        onClick={() => {
                          showPass(claimFor(selectedMatch)!);
                          setSelectedMatch(null);
                        }}
                      >
                        View pickup pass
                        <ScanLine size={16} />
                      </button>
                    )}
                  </div>
                ) : !adminPortal ? (
                  <form
                    className="form-stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      perform(
                        () =>
                          api.submitClaim(
                            selectedMatch.id,
                            String(new FormData(form).get("answer")),
                          ),
                        "Ownership verification submitted privately.",
                      );
                    }}
                  >
                    <label>
                      Describe a detail only the owner would know
                      <textarea
                        name="answer"
                        required
                        minLength={10}
                        maxLength={1500}
                        rows={4}
                        placeholder="A hidden marking, engraving, or specific detail. Do not include passwords or full ID numbers."
                      />
                    </label>
                    <PrivacyNote>
                      Your answer goes only to authorized campus staff. The
                      correct identifying details are never shown here.
                    </PrivacyNote>
                    <button className="button" disabled={busy}>
                      Submit ownership claim
                      <ArrowRight size={15} />
                    </button>
                    <button
                      type="button"
                      className="text-link muted"
                      onClick={() =>
                        perform(async () => {
                          await api.dismissMatch(selectedMatch.id);
                          setSelectedMatch(null);
                        }, "Match dismissed.")
                      }
                    >
                      This is not my item
                    </button>
                  </form>
                ) : (
                  <div className="match-admin-links">
                    {[selectedMatch.lostId, selectedMatch.foundId].map(
                      (id, i) => {
                        const item = state.items.find((x) => x.id === id);
                        return (
                          item && (
                            <button
                              key={id}
                              className="button secondary"
                              onClick={() => {
                                setSelectedItem(item);
                                setSelectedMatch(null);
                              }}
                            >
                              Open {i === 0 ? "lost" : "found"} report
                              <ArrowRight size={15} />
                            </button>
                          )
                        );
                      },
                    )}
                  </div>
                )}
              </>
            )}
            {!selectedItem && !selectedMatch && pass && (
              <div className="pickup-pass">
                <span className="eyebrow">SINGLE-USE PICKUP PASS</span>
                <h2>Ready for pickup</h2>
                <p>{pass.pickupLocation}</p>
                {qr && (
                  <img
                    src={qr}
                    width={240}
                    height={240}
                    alt="Private pickup QR code"
                  />
                )}
                <code>{pass.code}</code>
                <p>
                  Show this pass and your university identity to campus staff.
                  Keep your code private.
                </p>
                <PrivacyNote>
                  Campus staff redeem this code once. It cannot be used again
                  after pickup.
                </PrivacyNote>
              </div>
            )}
            {actionError && (
              <div className="alert error" role="alert">
                {actionError}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
