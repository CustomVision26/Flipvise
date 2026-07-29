import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  PricingAddonsCatalog,
  type PricingAddonCard,
} from "@/components/pricing-addons-catalog";
import {
  getAddonCatalogSettings,
  getUserAddonEntitlement,
  isPlanEligibleForAddon,
  listPublishedActiveAddonsForPricing,
} from "@/db/queries/addons";
import { getAccessContext, guestAccessContext } from "@/lib/access";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { toClientJson } from "@/lib/to-client-json";

export const dynamic = "force-dynamic";

export default async function PricingAddOnsPage() {
  const settings = await getAddonCatalogSettings();
  if (!settings.pricingCatalogVisible) {
    redirect("/pricing");
  }

  let access = guestAccessContext();
  try {
    access = await getAccessContext();
  } catch {
    access = guestAccessContext();
  }

  const published = await listPublishedActiveAddonsForPricing();
  const cards: PricingAddonCard[] = [];

  for (const row of published) {
    const entitledRow =
      access.userId != null
        ? await getUserAddonEntitlement(access.userId, row.key)
        : null;
    const entitled = entitledRow?.status === "active";
    const eligible = isPlanEligibleForAddon(
      row.eligiblePlanIds,
      access.effectivePlanSlug,
    );
    const stripePriceConfigured = Boolean(
      resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey, "monthly"),
    );
    const yearlyPriceConfigured = Boolean(
      resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey, "yearly"),
    );

    cards.push({
      key: row.key,
      name: row.name,
      description: row.description,
      marketingBlurb: row.marketingBlurb,
      eligible,
      entitled,
      entitlementSource: entitled ? entitledRow?.source ?? null : null,
      canPurchase: eligible && !entitled && stripePriceConfigured && row.active,
      stripePriceConfigured,
      yearlyPriceConfigured,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-4">
        <Link
          href="/pricing"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit gap-2 text-muted-foreground",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to Pricing
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Add-on Catalog</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Optional features for eligible paid plans (monthly or yearly where
            configured). Add-ons stack on top of your current plan and can also
            be granted by a Team Admin or platform admin.
          </p>
        </div>
      </div>

      <PricingAddonsCatalog
        addons={toClientJson(cards)}
        signedIn={access.userId != null}
        effectivePlanSlug={access.effectivePlanSlug}
      />
    </div>
  );
}
