import { redirect } from "next/navigation";
import { createClerkClient } from "@clerk/backend";
import {
  ACCOUNT_RECOVERY_ONBOARDING_PATH,
  isAccountRecoveryProfileComplete,
} from "@/lib/account-recovery-profile";
import {
  DEFAULT_AUTH_REDIRECT,
  safeRedirectPath,
} from "@/lib/safe-redirect-path";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/**
 * On login / dashboard entry: send users who have not completed account details
 * to the onboarding form. Users who already completed it are never redirected.
 * Fail open if Clerk metadata cannot be loaded (do not block access).
 */
export async function redirectIfAccountRecoveryIncomplete(
  userId: string,
  continuePath: string = DEFAULT_AUTH_REDIRECT,
): Promise<void> {
  if (continuePath.startsWith(ACCOUNT_RECOVERY_ONBOARDING_PATH)) {
    return;
  }

  let complete = false;
  try {
    const user = await clerkClient.users.getUser(userId);
    // Keep this gate free of country-state-city (Turbopack/RSC-safe).
    complete = isAccountRecoveryProfileComplete(
      user.publicMetadata as Record<string, unknown>,
      user.privateMetadata as Record<string, unknown>,
    );
  } catch {
    return;
  }

  // Already filled out — never show the account details page again.
  if (complete) return;

  const safeContinue = safeRedirectPath(continuePath);
  redirect(
    `${ACCOUNT_RECOVERY_ONBOARDING_PATH}?redirect=${encodeURIComponent(safeContinue)}`,
  );
}
