import { redirect } from "next/navigation";
import {
  canAccessAddon,
  getAccessContext,
  type AccessContext,
} from "@/lib/access";
import {
  AI_DOCUMENT_STUDIO_ADDON_KEYS,
  AI_ESSAY_ADDON_KEY,
  hasAnyAiDocumentStudioAddon,
} from "@/lib/addon-keys";
import { getAddonCatalogSettings } from "@/db/queries/addons";
import { AI_DOC_STUDIO_BASE } from "@/lib/ai-document-studio-paths";

export { hasAnyAiDocumentStudioAddon };

/**
 * True when the user may open AI Document Studio (any document-type add-on,
 * or platform admin previewing from `/admin/add-ons`).
 */
export function hasAiDocumentStudioAccess(ctx: AccessContext): boolean {
  return ctx.isAdmin || hasAnyAiDocumentStudioAddon(ctx.activeAddonKeys);
}

/** Redirect target when the user lacks AI Document Studio access. */
export async function redirectPathForMissingAiDocStudio(): Promise<string> {
  try {
    const settings = await getAddonCatalogSettings();
    if (settings.pricingCatalogVisible) return "/pricing/add-ons";
  } catch {
    // Fall through.
  }
  return "/dashboard";
}

/**
 * Gate for the AI Document Studio hub — any active document-type add-on.
 */
export async function requireAiDocumentStudioAccess(
  mode: "page" | "action" = "page",
): Promise<AccessContext & { userId: string }> {
  const access = await getAccessContext();
  if (!access.userId) {
    if (mode === "page") redirect("/");
    throw new Error("Unauthorized");
  }
  if (!hasAiDocumentStudioAccess(access)) {
    if (mode === "page") redirect(await redirectPathForMissingAiDocStudio());
    throw new Error("AI Document Studio add-on required.");
  }
  return access as AccessContext & { userId: string };
}

/** Which studio document types the user can open right now. */
export function unlockedAiDocumentStudioAddonKeys(
  ctx: AccessContext,
): string[] {
  return AI_DOCUMENT_STUDIO_ADDON_KEYS.filter((key) =>
    canAccessAddon(ctx, key),
  );
}

export function canAccessAiEssayInStudio(ctx: AccessContext): boolean {
  return ctx.isAdmin || canAccessAddon(ctx, AI_ESSAY_ADDON_KEY);
}

export { AI_DOC_STUDIO_BASE };
