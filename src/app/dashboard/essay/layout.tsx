import { redirect } from "next/navigation";
import { getAccessContext, canAccessAddon } from "@/lib/access";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { EssayDashboardShell } from "@/components/essay-dashboard-shell";

export default async function EssayDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getAccessContext();
  if (!access.userId) redirect("/");

  const unlocked = canAccessAddon(access, AI_ESSAY_ADDON_KEY);

  return <EssayDashboardShell unlocked={unlocked}>{children}</EssayDashboardShell>;
}
