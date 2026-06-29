import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import { FLIPVISE_NATIVE_QUERY_PARAM } from "@/lib/flipvise-native-constants";
import {
  isFlipviseNativeUserAgent,
} from "@/lib/native-live-navigation";
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
 * Post–Clerk-auth hop: Clerk buttons redirect here first so we resolve session
 * (`getAccessContext`) before landing on `/dashboard?userid=…&plan=…`.
 *
 * Retries exist because Clerk's JWT can arrive slightly after the browser
 * lands on this page, especially inside the Android WebView.
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

  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent");
  const isNativeRequest = isFlipviseNativeUserAgent(userAgent);
  const retryAttempts = isNativeRequest ? 6 : 2;
  const retryDelayMs = isNativeRequest ? 500 : 800;

  const ctx = await resolveAccessContextWithRetry(retryAttempts, retryDelayMs);

  if (!ctx.userId) {
    if (isNativeRequest) {
      redirect(
        `/native-signin?${FLIPVISE_NATIVE_QUERY_PARAM}=1&session_retry=1&redirect=${encodeURIComponent(requestedPath)}`,
      );
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
