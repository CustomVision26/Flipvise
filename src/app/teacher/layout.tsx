import type { Metadata } from "next";
import { requireTeacherDashboardAccess } from "@/lib/teacher-access";
import { TeacherDashboardShell } from "@/components/teacher-dashboard-shell";

export const metadata: Metadata = {
  title: "Teacher Dashboard",
};

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTeacherDashboardAccess();
  return (
    <section
      aria-label="Teacher dashboard"
      className="relative flex min-h-0 flex-1 flex-col"
      data-route-group="teacher"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-background/30 backdrop-blur-[1px]"
        aria-hidden
      />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">
        <TeacherDashboardShell>{children}</TeacherDashboardShell>
      </div>
    </section>
  );
}
