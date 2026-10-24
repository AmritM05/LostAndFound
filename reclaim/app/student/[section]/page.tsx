import Portal from "../../../components/portal/Portal";
export const dynamicParams = false;
export function generateStaticParams() {
  return ["overview", "search", "report", "map", "reports", "updates"].map(
    (section) => ({ section }),
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const titles: Record<string, string> = {
    overview: "Overview",
    search: "Search",
    report: "Report a Lost Item",
    map: "Campus map",
    reports: "My reports",
    updates: "Magpie Updates",
    matches: "Potential matches",
    claims: "Ownership claims",
    pickup: "Secure pickup",
    statistics: "Statistics",
  };
  return { title: titles[section] || "Overview" };
}
export default async function StudentPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return <Portal section={section} />;
}
