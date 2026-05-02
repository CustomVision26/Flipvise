import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";

/**
 * Post–Clerk-auth hop: Clerk buttons redirect here first so we resolve session
 * (`getAccessContext`) before landing on a clean `/dashboard` URL.
 *
 * A short retry is included because Clerk's JWT can arrive slightly after the
 * browser lands on this page, causing `auth()` to return no userId on the
 * very first render.
 */
export default async function AuthContinuePage() {
  let userId: string | null = null;

  // First attempt
  const ctx = await getAccessContext();
  userId = ctx.userId;

  // If Clerk's JWT hasn't propagated yet, wait briefly and retry once.
  if (!userId) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const retried = await getAccessContext();
    userId = retried.userId;
  }

  if (!userId) redirect("/");
  redirect(personalDashboardHref());
}
