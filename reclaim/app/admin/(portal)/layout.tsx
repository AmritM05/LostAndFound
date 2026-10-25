import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentAdmin } from "../../../lib/server/adminSession";
import { ServiceFailure } from "../../../lib/server/diagnostics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let admin;
  try {
    admin = await currentAdmin(
      new Request("http://internal/admin/", { headers: await headers() }),
    );
  } catch (error) {
    if (error instanceof ServiceFailure)
      return (
        <main className="auth-page">
          <section className="auth-card">
            <h1>Admin Portal</h1>
            <p role="alert">{error.safeMessage}</p>
            <a href="/admin/login/">Return to staff sign-in</a>
          </section>
        </main>
      );
    throw error;
  }
  if (!admin) redirect("/admin/login/");
  return children;
}
