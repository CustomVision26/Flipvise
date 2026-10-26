import { redirect } from "next/navigation";
import { createClerkClient } from "@clerk/backend";
import { getAccessContext } from "@/lib/access";
import { AccountRecoveryOnboardingForm } from "@/components/account-recovery-onboarding-form";
import {
  ACCOUNT_RECOVERY_ONBOARDING_PATH,
  isAccountRecoveryProfileComplete,
} from "@/lib/account-recovery-profile";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import {
  DEFAULT_AUTH_REDIRECT,
  safeRedirectPath,
} from "@/lib/safe-redirect-path";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

interface AccountRecoveryOnboardingPageProps {
  searchParams: Promise<{ redirect?: string | string[] }>;
}

export default async function AccountRecoveryOnboardingPage({
  searchParams,
}: AccountRecoveryOnboardingPageProps) {
  const sp = await searchParams;
  const redirectRaw =
    typeof sp.redirect === "string"
      ? sp.redirect
      : Array.isArray(sp.redirect)
        ? sp.redirect[0]
        : undefined;
  const requestedPath = safeRedirectPath(redirectRaw);

  const ctx = await getAccessContext();
  if (!ctx.userId) {
    redirect("/");
  }

  let recoveryComplete = false;
  try {
    const user = await clerkClient.users.getUser(ctx.userId);
    // Base completeness only on this RSC page (avoids loading country-state-city in SSR).
    recoveryComplete = isAccountRecoveryProfileComplete(
      user.publicMetadata as Record<string, unknown>,
      user.privateMetadata as Record<string, unknown>,
    );
  } catch {
    recoveryComplete = false;
  }

  if (recoveryComplete) {
    if (requestedPath !== DEFAULT_AUTH_REDIRECT) {
      redirect(requestedPath);
    }
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

  const continueAfterSave =
    requestedPath.startsWith(ACCOUNT_RECOVERY_ONBOARDING_PATH)
      ? DEFAULT_AUTH_REDIRECT
      : requestedPath;

  return (
    <div className="account-recovery-page flex flex-1 flex-col items-center justify-start px-4 py-10 sm:px-6 sm:py-14">
      <AccountRecoveryOnboardingForm redirectTo={continueAfterSave} />
    </div>
  );
}
