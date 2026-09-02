import { stripe } from "@/lib/stripe";
import { FLIPVISE_SAAS_TAX_CODE } from "@/lib/stripe-product-tax";
import { ensureCatalogAlignedPriceId } from "@/lib/stripe-catalog-price";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";

export async function findStripeProductByAddonKey(
  addonKey: string,
): Promise<string | null> {
  for await (const product of stripe.products.list({ active: true, limit: 100 })) {
    if (product.metadata?.flipvise_addon_key === addonKey) {
      return product.id;
    }
  }
  return null;
}

export async function syncStripeAddonProductFromCatalog(input: {
  addonKey: string;
  name: string;
  description: string;
  stripePriceEnvKey: string;
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
}): Promise<{ productId: string | null; monthlyPriceId: string | null; yearlyPriceId: string | null }> {
  const monthlyEnvId = resolveStripeAddonPriceIdFromEnvKey(
    input.stripePriceEnvKey,
    "monthly",
  );
  const yearlyEnvId = resolveStripeAddonPriceIdFromEnvKey(
    input.stripePriceEnvKey,
    "yearly",
  );

  let productId = await findStripeProductByAddonKey(input.addonKey);
  if (!productId && monthlyEnvId) {
    try {
      const price = await stripe.prices.retrieve(monthlyEnvId);
      const product = price.product;
      productId = typeof product === "string" ? product : product?.id ?? null;
    } catch {
      productId = null;
    }
  }

  if (productId) {
    await stripe.products.update(productId, {
      name: input.name,
      description: input.description,
      tax_code: FLIPVISE_SAAS_TAX_CODE,
      metadata: {
        flipvise_addon_key: input.addonKey,
        type: "addon",
      },
    });
  }

  let monthlyPriceId: string | null = monthlyEnvId;
  if (monthlyEnvId && input.monthlyPrice != null && input.monthlyPrice > 0) {
    monthlyPriceId = await ensureCatalogAlignedPriceId({
      configuredPriceId: monthlyEnvId,
      period: "monthly",
      monthlyPrice: input.monthlyPrice,
      yearlyMonthlyPrice: input.yearlyMonthlyPrice,
      nickname: `Flipvise ${input.addonKey} monthly ($${input.monthlyPrice})`,
      productMetadata: { key: "flipvise_addon_key", value: input.addonKey },
    });
  }

  let yearlyPriceId: string | null = yearlyEnvId;
  if (yearlyEnvId && input.yearlyMonthlyPrice != null && input.yearlyMonthlyPrice > 0) {
    yearlyPriceId = await ensureCatalogAlignedPriceId({
      configuredPriceId: yearlyEnvId,
      period: "yearly",
      monthlyPrice: input.monthlyPrice,
      yearlyMonthlyPrice: input.yearlyMonthlyPrice,
      nickname: `Flipvise ${input.addonKey} yearly ($${Math.round(input.yearlyMonthlyPrice * 12)})`,
      productMetadata: { key: "flipvise_addon_key", value: input.addonKey },
    });
  }

  return { productId, monthlyPriceId, yearlyPriceId };
}
