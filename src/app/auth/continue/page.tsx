import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";

/**
 * Post–Clerk-auth hop: Clerk buttons redirect here first so we can attach
 * `userid` + `plan` before landing on `/dashboard`.
 */
export default async function AuthContinuePage() {
  const { userId, isPro, activeTeamPlan } = await getAccessContext();
  if (!userId) redirect("/");
  redirect(personalDashboardHref(userId, activeTeamPlan, isPro));
}
