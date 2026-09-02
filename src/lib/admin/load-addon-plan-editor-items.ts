import { listAddonCatalog, type AddonCatalogRow } from "@/db/queries/addons";
import { stripe } from "@/lib/stripe";
import { roundMajor } from "@/lib/money-math";
import { majorPerBillingCycleFromSubscriptionPrice } from "@/lib/stripe-pricing-display";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";

export type AdminAddonPlanEditorItem = {
  key: string;
  name: string;
  description: string;
  marketingBlurb: string;
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
  stripePriceEnvKey: string;
  stripeMonthlyConfigured: boolean;
  stripeYearlyConfigured: boolean;
};

async function majorFromPriceId(priceId: string | null): Promise<number | null> {
  if (!priceId) return null;
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active) return null;
    return majorPerBillingCycleFromSubscriptionPrice(price);
  } catch {
    return null;
  }
}

function catalogOrStripe(
  catalog: number | null | undefined,
  stripeMajor: number | null,
): number | null {
  if (catalog != null && catalog > 0) return catalog;
  return stripeMajor;
}

export async function loadAdminAddonPlanEditorItems(): Promise<
  AdminAddonPlanEditorItem[]
> {
  let rows: AddonCatalogRow[] = [];
  try {
    rows = await listAddonCatalog();
  } catch {
    return [];
  }

  const items: AdminAddonPlanEditorItem[] = [];
  for (const row of rows) {
    const monthlyId = resolveStripeAddonPriceIdFromEnvKey(
      row.stripePriceEnvKey,
      "monthly",
    );
    const yearlyId = resolveStripeAddonPriceIdFromEnvKey(
      row.stripePriceEnvKey,
      "yearly",
    );
    const [monthlyMajor, yearlyCycleMajor] = await Promise.all([
      majorFromPriceId(monthlyId),
      majorFromPriceId(yearlyId),
    ]);
    const yearlyMonthlyFromStripe =
      yearlyCycleMajor != null ? roundMajor(yearlyCycleMajor / 12) : null;

    items.push({
      key: row.key,
      name: row.name,
      description: row.description,
      marketingBlurb: row.marketingBlurb,
      monthlyPrice: catalogOrStripe(row.monthlyPrice, monthlyMajor),
      yearlyMonthlyPrice: catalogOrStripe(
        row.yearlyMonthlyPrice,
        yearlyMonthlyFromStripe,
      ),
      stripePriceEnvKey: row.stripePriceEnvKey,
      stripeMonthlyConfigured: Boolean(monthlyId),
      stripeYearlyConfigured: Boolean(yearlyId),
    });
  }
  return items;
}
