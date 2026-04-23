import { auth } from "@/lib/clerk-auth";
import { redirect } from "next/navigation";
import { userHasTeamAdminDashboardAccess } from "@/db/queries/teams";
import { tryTeamQuery } from "@/lib/team-query-fallback";

export default async function TeamAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const allowed = await tryTeamQuery(
    () => userHasTeamAdminDashboardAccess(userId),
    false,
  );
  if (!allowed) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
