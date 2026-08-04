import { redirect } from "next/navigation";
import {
  accessHasAddon,
  canAccessAddon,
  getAccessContext,
  type AccessContext,
} from "@/lib/access";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { getAddonCatalogSettings } from "@/db/queries/addons";
import {
  getTeamMembershipsForUser,
  getTeamsByOwner,
} from "@/db/queries/teams";

export { accessHasAddon, canAccessAddon };

/**
 * True when the user may use AI Essay (Stripe/admin entitlement, or platform
 * admin previewing from `/admin/add-ons`). Team-sourced grants are ignored.
 */
export function hasEssayAddon(ctx: AccessContext): boolean {
  return ctx.isAdmin || canAccessAddon(ctx, AI_ESSAY_ADDON_KEY);
}

/**
 * Workspace members (not the subscription owner / personal paid subscriber)
 * cannot use or purchase AI Essay yet — show Coming soon instead of unlock.
 */
export async function isAiEssayComingSoonForTeamMember(
  userId: string,
  access: Pick<
    AccessContext,
    | "isAdmin"
    | "hasClerkPersonalPro"
    | "hasClerkPersonalProPlus"
    | "activeAddonKeys"
  >,
): Promise<boolean> {
  if (access.isAdmin) return false;
  if (access.activeAddonKeys.includes(AI_ESSAY_ADDON_KEY)) return false;
  if (access.hasClerkPersonalPro || access.hasClerkPersonalProPlus) return false;

  const owned = await getTeamsByOwner(userId);
  if (owned.length > 0) return false;

  const memberships = await getTeamMembershipsForUser(userId);
  return memberships.length > 0;
}

/** Where to send users who lack a paid AI Essay entitlement. */
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
 * Access requires a Stripe-paid or admin entitlement — not plan alone.
 * Team members without owner/personal eligibility see Coming soon on pages.
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
    if (mode === "page") {
      const comingSoon = await isAiEssayComingSoonForTeamMember(
        access.userId,
        access,
      );
      if (comingSoon) {
        redirect("/dashboard/ai-doc-studio/ai-essay");
      }
      redirect(await redirectPathForMissingEssayAddon());
    }
    const comingSoon = await isAiEssayComingSoonForTeamMember(
      access.userId,
      access,
    );
    if (comingSoon) {
      throw new Error(
        "AI Essay for workspace members is coming soon. Only the plan owner can use it on their personal dashboard right now.",
      );
    }
    throw new Error("AI Essay add-on required.");
  }
  return access as AccessContext & { userId: string };
}
