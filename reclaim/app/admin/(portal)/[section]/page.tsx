import { notFound } from "next/navigation";
import AdminPortal from "../../../../components/admin/AdminPortal";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    !["found", "reports", "matches", "claims", "pickup", "dropoffs"].includes(
      section,
    )
  )
    notFound();
  return <AdminPortal section={section} />;
}
