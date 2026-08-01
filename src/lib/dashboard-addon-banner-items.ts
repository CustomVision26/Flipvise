import {
  isPlanEligibleForAddon,
  listAddonCatalog,
} from "@/db/queries/addons";
import { isAiDocumentStudioAddonKey } from "@/lib/addon-keys";
import { AI_DOC_STUDIO_BASE } from "@/lib/ai-document-studio-paths";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";

export type DashboardAddonBannerItem = {
  key: string;
  name: string;
  blurb: string;
  unlocked: boolean;
  canPurchase: boolean;
  /** Destination when unlocked; omit to open unlock flow. */
  href?: string | null;
};

function addonFeatureHref(addonKey: string): string | null {
  // Unlocked document-type add-ons open via the AI Document Studio entry button.
  if (isAiDocumentStudioAddonKey(addonKey)) return AI_DOC_STUDIO_BASE;
  return null;
}

export async function buildDashboardAddonBannerItems(input: {
  activeAddonKeys: string[];
  effectivePlanSlug: string | null;
}): Promise<DashboardAddonBannerItem[]> {
  const catalog = await listAddonCatalog();
  return catalog
    .filter((row) => row.active)
    .map((row) => {
      const unlocked = input.activeAddonKeys.includes(row.key);
      const eligible = isPlanEligibleForAddon(
        row.eligiblePlanIds,
        input.effectivePlanSlug,
      );
      const stripePriceConfigured = Boolean(
        resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey, "monthly"),
      );
      return {
        key: row.key,
        name: row.name,
        blurb: row.marketingBlurb || row.description,
        unlocked,
        canPurchase: eligible && !unlocked && stripePriceConfigured,
        href: unlocked ? addonFeatureHref(row.key) : null,
      };
    })
    // Unlocked studio document types use the dedicated Studio button instead.
    .filter(
      (item) => !(item.unlocked && isAiDocumentStudioAddonKey(item.key)),
    );
}
