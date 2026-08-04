import {
  isPlanEligibleForAddon,
  listAddonCatalog,
} from "@/db/queries/addons";
import {
  AI_ESSAY_ADDON_KEY,
  isAiDocumentStudioAddonKey,
  LIVE_CLASSROOM_ADDON_KEY,
} from "@/lib/addon-keys";
import { AI_DOC_STUDIO_BASE } from "@/lib/ai-document-studio-paths";
import { LIVE_CLASSROOM_ROOT_PATH } from "@/lib/live-classroom-url";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";

export type DashboardAddonBannerItem = {
  key: string;
  name: string;
  blurb: string;
  unlocked: boolean;
  canPurchase: boolean;
  /** Workspace members cannot unlock AI Essay yet. */
  comingSoon?: boolean;
  /** Destination when unlocked; omit to open unlock flow. */
  href?: string | null;
};

function addonFeatureHref(addonKey: string): string | null {
  // Unlocked document-type add-ons open via the AI Document Studio entry button.
  if (isAiDocumentStudioAddonKey(addonKey)) return AI_DOC_STUDIO_BASE;
  if (addonKey === LIVE_CLASSROOM_ADDON_KEY) return LIVE_CLASSROOM_ROOT_PATH;
  return null;
}

export async function buildDashboardAddonBannerItems(input: {
  activeAddonKeys: string[];
  effectivePlanSlug: string | null;
  /** When true, AI Essay shows Coming soon instead of Unlock. */
  aiEssayComingSoonForUser?: boolean;
}): Promise<DashboardAddonBannerItem[]> {
  const catalog = await listAddonCatalog();
  return catalog
    .filter((row) => row.active && row.publishedOnBanner !== false)
    .map((row) => {
      const unlocked = input.activeAddonKeys.includes(row.key);
      const essayComingSoon =
        row.key === AI_ESSAY_ADDON_KEY &&
        Boolean(input.aiEssayComingSoonForUser) &&
        !unlocked;
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
        comingSoon: essayComingSoon,
        canPurchase:
          !essayComingSoon && eligible && !unlocked && stripePriceConfigured,
        href: unlocked ? addonFeatureHref(row.key) : null,
      };
    })
    // Unlocked studio document types use the dedicated Studio button instead.
    .filter(
      (item) => !(item.unlocked && isAiDocumentStudioAddonKey(item.key)),
    );
}
