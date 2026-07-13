import type { Metadata } from "next";
import { assertAdminDashboardAccess } from "@/lib/admin/assert-admin-access";
import { AdminDashboardShell } from "@/components/admin-dashboard-shell";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await assertAdminDashboardAccess();

  return (
    <section
      aria-label="Platform administration"
      className="relative flex min-h-0 flex-1 flex-col"
      data-route-group="admin"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-background/30 backdrop-blur-[1px]"
        aria-hidden
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <AdminDashboardShell>{children}</AdminDashboardShell>
      </div>
    </section>
  );
}
