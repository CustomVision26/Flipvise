import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";

/**
 * Post–Clerk-auth hop: Clerk buttons redirect here first so we resolve session
 * (`getAccessContext`) before landing on `/dashboard?userid=…&plan=…`.
 *
 * A short retry is included because Clerk's JWT can arrive slightly after the
 * browser lands on this page, causing `auth()` to return no userId on the
 * very first render.
 */
export default async function AuthContinuePage() {
  let ctx = await getAccessContext();

  // If Clerk's JWT hasn't propagated yet, wait briefly and retry once.
  if (!ctx.userId) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    ctx = await getAccessContext();
  }

  if (!ctx.userId) redirect("/");
  redirect(
    personalDashboardHrefWithUserPlanQuery({
      userId: ctx.userId,
      activeTeamPlan: ctx.activeTeamPlan,
      isPro: ctx.isPro,
      hasClerkPersonalPro: ctx.hasClerkPersonalPro,
      hasClerkPersonalProPlus: ctx.hasClerkPersonalProPlus,
    }),
  );
}
