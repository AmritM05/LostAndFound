import { type ReactNode } from "react";
import { LockKeyhole, Inbox } from "lucide-react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={25} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function PrivacyNote({ children }: { children?: ReactNode }) {
  return (
    <div className="privacy-note">
      <LockKeyhole size={15} />
      <span>
        {children ||
          "Photos and identifying details are excluded from Search. Email-only demo login does not verify identity."}
      </span>
    </div>
  );
}
export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export const dateLabel = (date: string) =>
  new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(date) ? date + "T12:00:00" : date,
  ).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
