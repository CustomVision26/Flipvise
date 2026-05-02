import { redirect } from "next/navigation";
import { TEAM_ADMIN_INVITE_HISTORY_PATH } from "@/lib/team-admin-url";

/**
 * Legacy URL `/invite-members/invite-history` → canonical `/invite-members/invitation-history`.
 */
export default async function TeamAdminInviteHistoryLegacyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; userid?: string; plan?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (typeof sp.team === "string" && sp.team !== "") q.set("team", sp.team);
  if (typeof sp.userid === "string" && sp.userid.trim() !== "") q.set("userid", sp.userid.trim());
  if (typeof sp.plan === "string" && sp.plan.trim() !== "") q.set("plan", sp.plan.trim());
  const suffix = q.toString();
  redirect(suffix ? `${TEAM_ADMIN_INVITE_HISTORY_PATH}?${suffix}` : TEAM_ADMIN_INVITE_HISTORY_PATH);
}
