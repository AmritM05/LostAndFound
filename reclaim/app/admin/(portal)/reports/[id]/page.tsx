import AdminPortal from "../../../../../components/admin/AdminPortal";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <AdminPortal section="reports" reportId={(await params).id} />;
}
