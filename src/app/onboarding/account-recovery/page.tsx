import { redirect } from "next/navigation";
import { createClerkClient } from "@clerk/backend";
import { Shield } from "lucide-react";
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
    <div className="flex flex-1 flex-col items-center justify-start gap-8 p-4 pt-10 sm:p-8 sm:pt-14">
      <div className="flex w-full max-w-lg flex-col items-center gap-7">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-muted/40">
            <Shield className="h-5 w-5 text-foreground/80" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Complete your account details
            </h1>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              Complete three short steps: contact details, account type, and
              security questions. This helps verify your identity if you lose
              access.
            </p>
          </div>
        </div>
        <AccountRecoveryOnboardingForm redirectTo={continueAfterSave} />
      </div>
    </div>
  );
}
