import { getAccessContext } from "@/lib/access";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";

export async function resolvePublicPageHomeContext() {
  let homeHref = "/";
  let isSignedIn = false;
  try {
    const access = await getAccessContext();
    if (access.userId) {
      isSignedIn = true;
      homeHref = personalDashboardHrefWithUserPlanQuery({
        userId: access.userId,
        activeTeamPlan: access.activeTeamPlan,
        isPro: access.isPro,
        hasClerkPersonalPro: access.hasClerkPersonalPro,
        hasClerkPersonalProPlus: access.hasClerkPersonalProPlus,
      });
    }
  } catch {
    homeHref = "/";
  }
  return { homeHref, isSignedIn };
}
