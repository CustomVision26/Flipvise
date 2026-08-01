import { redirect } from "next/navigation";
import {
  accessHasAddon,
  canAccessAddon,
  getAccessContext,
  type AccessContext,
} from "@/lib/access";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { getAddonCatalogSettings } from "@/db/queries/addons";

export { accessHasAddon, canAccessAddon };

/**
 * True when the user may use AI Essay (Stripe, team/admin grant, or platform admin
 * previewing from `/admin/add-ons`).
 */
export function hasEssayAddon(ctx: AccessContext): boolean {
  return ctx.isAdmin || canAccessAddon(ctx, AI_ESSAY_ADDON_KEY);
}

/** Where to send users who lack a paid or assigned AI Essay entitlement. */
export async function redirectPathForMissingEssayAddon(): Promise<string> {
  try {
    const settings = await getAddonCatalogSettings();
    if (settings.pricingCatalogVisible) return "/pricing/add-ons";
  } catch {
    // Fall through.
  }
  return "/dashboard";
}

/**
 * Server-side gate for Essay pages and actions.
 * Throws for actions; redirects unauthenticated / locked users from pages.
 * Access requires a Stripe-paid or admin/team-assigned entitlement — not plan alone.
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
    if (mode === "page") redirect(await redirectPathForMissingEssayAddon());
    throw new Error("AI Essay add-on required.");
  }
  return access as AccessContext & { userId: string };
}
