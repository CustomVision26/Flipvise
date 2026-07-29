import { redirect } from "next/navigation";
import {
  accessHasAddon,
  canAccessAddon,
  getAccessContext,
  type AccessContext,
} from "@/lib/access";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";

export { accessHasAddon, canAccessAddon };

/** True when the user may use AI Essay (Stripe, team grant, or platform admin grant). */
export function hasEssayAddon(ctx: AccessContext): boolean {
  return canAccessAddon(ctx, AI_ESSAY_ADDON_KEY);
}

/**
 * Server-side gate for Essay pages and actions.
 * Throws for actions; redirects unauthenticated / locked users from pages.
 */
export async function requireEssayAddonAccess(
  mode: "page" | "action" = "action",
): Promise<AccessContext & { userId: string }> {
  const access = await getAccessContext();
  if (!access.userId) {
    if (mode === "page") redirect("/");
    throw new Error("Unauthorized");
  }
  if (!hasEssayAddon(access)) {
    if (mode === "page") redirect("/dashboard/essay");
    throw new Error("AI Essay add-on required.");
  }
  return access as AccessContext & { userId: string };
}
