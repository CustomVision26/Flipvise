import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import {
  nativeSignInPath,
  isNativeShellRequest,
} from "@/lib/native-auth-redirect";
import {
  DEFAULT_AUTH_REDIRECT,
  safeRedirectPath,
} from "@/lib/safe-redirect-path";

interface AuthContinuePageProps {
  searchParams: Promise<{ redirect?: string | string[] }>;
}

async function resolveAccessContextWithRetry(
  attempts: number,
  delayMs: number,
) {
  let ctx = await getAccessContext();
  for (let i = 1; i < attempts && !ctx.userId; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    ctx = await getAccessContext();
  }
  return ctx;
}

/**
 * Post–Clerk-auth hop: waits for Clerk JWT cookies, then lands on the dashboard.
 */
export default async function AuthContinuePage({
  searchParams,
}: AuthContinuePageProps) {
  const sp = await searchParams;
  const redirectRaw =
    typeof sp.redirect === "string"
      ? sp.redirect
      : Array.isArray(sp.redirect)
        ? sp.redirect[0]
        : undefined;
  const requestedPath = safeRedirectPath(redirectRaw);

  const isNative = await isNativeShellRequest();
  const ctx = await resolveAccessContextWithRetry(isNative ? 12 : 3, 500);

  if (!ctx.userId) {
    if (isNative) {
      redirect(nativeSignInPath(requestedPath, { session_retry: "1" }));
    }
    redirect("/");
  }

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
