import { listAddonCatalog } from "@/db/queries/addons";
import {
  isAccessEligibleForAddon,
  type AddonEligibilityAccess,
} from "@/lib/addon-plan-eligibility";
import {
  AI_ESSAY_ADDON_KEY,
  isAiDocumentStudioAddonKey,
  LIVE_CLASSROOM_ADDON_KEY,
} from "@/lib/addon-keys";
import { AI_DOC_STUDIO_BASE } from "@/lib/ai-document-studio-paths";
import { LIVE_CLASSROOM_BRIDGE_PATH } from "@/lib/live-classroom-url";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";

export type DashboardAddonBannerItem = {
  key: string;
  name: string;
  blurb: string;
  unlocked: boolean;
  canPurchase: boolean;
  eligible: boolean;
  monthlyPriceConfigured: boolean;
  yearlyPriceConfigured: boolean;
  stripePriceConfigured: boolean;
  /** Workspace members cannot unlock AI Essay yet. */
  comingSoon?: boolean;
  /** Destination when unlocked; omit to open unlock flow. */
  href?: string | null;
};

function addonFeatureHref(addonKey: string): string | null {
  // Unlocked document-type add-ons open via the AI Document Studio entry button.
  if (isAiDocumentStudioAddonKey(addonKey)) return AI_DOC_STUDIO_BASE;
  if (addonKey === LIVE_CLASSROOM_ADDON_KEY) return LIVE_CLASSROOM_BRIDGE_PATH;
  return null;
}

export async function buildDashboardAddonBannerItems(input: {
  activeAddonKeys: string[];
  /** When true, AI Essay shows Coming soon instead of Unlock. */
  aiEssayComingSoonForUser?: boolean;
} & AddonEligibilityAccess): Promise<DashboardAddonBannerItem[]> {
  // Active + In banner → every signed-in user sees the chip. Entitlement only
  // switches Unlock vs Open; it must not hide the add-on from the banner.
  const catalog = await listAddonCatalog();
  return catalog
    .filter((row) => row.active && row.publishedOnBanner !== false)
    .map((row) => {
      const unlocked = input.activeAddonKeys.includes(row.key);
      const essayComingSoon =
        row.key === AI_ESSAY_ADDON_KEY &&
        Boolean(input.aiEssayComingSoonForUser) &&
        !unlocked;
      const eligible = isAccessEligibleForAddon(row.eligiblePlanIds, input);
      const monthlyPriceConfigured = Boolean(
        resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey, "monthly"),
      );
      const yearlyPriceConfigured = Boolean(
        resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey, "yearly"),
      );
      const stripePriceConfigured =
        monthlyPriceConfigured || yearlyPriceConfigured;
      return {
        key: row.key,
        name: row.name,
        blurb: row.marketingBlurb || row.description,
        unlocked,
        comingSoon: essayComingSoon,
        eligible,
        monthlyPriceConfigured,
        yearlyPriceConfigured,
        stripePriceConfigured,
        canPurchase:
          !essayComingSoon && eligible && !unlocked && stripePriceConfigured,
        href: unlocked ? addonFeatureHref(row.key) : null,
      };
    });
}
