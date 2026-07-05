import type { Metadata } from "next";
import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { userHasTeamAdminDashboardAccess } from "@/db/queries/teams";
import { redirectIfPlanReconciliationPending } from "@/lib/plan-reconciliation-gate";
import { tryTeamQuery } from "@/lib/team-query-fallback";

export const metadata: Metadata = {
  title: "Team Admin",
};

export default async function TeamAdminRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  await redirectIfPlanReconciliationPending(userId);

  const allowed = await tryTeamQuery(
    () => userHasTeamAdminDashboardAccess(userId),
    false,
  );
  if (!allowed) {
    redirect("/dashboard");
  }

  return (
    <section
      aria-label="Team administration"
      className="flex min-h-0 flex-1 flex-col"
      data-route-group="team-admin"
    >
      {children}
    </section>
  );
}
