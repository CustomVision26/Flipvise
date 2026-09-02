import { formatCurrencyFromCents } from "@/lib/format-currency";
import { roundMajor } from "@/lib/money-math";

export type AddonStripePriceLabels = {
  /** e.g. "$8.99/mo" — charged each month */
  monthlyLabel: string | null;
  /**
   * Actual amount charged for a year of the add-on, e.g. "$95.88/yr".
   * Prefer this for the yearly hero price (not a monthly-equivalent).
   */
  yearlyLabel: string | null;
  /** Effective monthly rate when paying yearly, e.g. "$7.99/mo" */
  yearlyMonthlyEquivalentLabel: string | null;
  monthlyConfigured: boolean;
  yearlyConfigured: boolean;
};

export function formatAddonPriceMajor(amount: number, currency: string): string {
  const cents = Math.round(amount * 100);
  return formatCurrencyFromCents(cents, currency);
}

function catalogMonthlyLabel(monthlyPrice: number | null | undefined): string | null {
  if (monthlyPrice == null || monthlyPrice <= 0) return null;
  return `${formatAddonPriceMajor(monthlyPrice, "usd")}/mo`;
}

function catalogYearlyLabels(yearlyMonthlyPrice: number | null | undefined): {
  yearlyLabel: string | null;
  yearlyMonthlyEquivalentLabel: string | null;
} {
  if (yearlyMonthlyPrice == null || yearlyMonthlyPrice <= 0) {
    return { yearlyLabel: null, yearlyMonthlyEquivalentLabel: null };
  }
  const annual = roundMajor(yearlyMonthlyPrice * 12);
  return {
    yearlyLabel: `${formatAddonPriceMajor(annual, "usd")}/yr`,
    yearlyMonthlyEquivalentLabel: `${formatAddonPriceMajor(yearlyMonthlyPrice, "usd")}/mo`,
  };
}

/**
 * Addon Plans (`addon_catalog` amounts) are the marketing source of truth.
 * Stripe fills gaps only when the catalog omits an amount — same rule as `/admin/plans`.
 */
export function mergeAddonPriceLabelsWithCatalog(
  stripe: AddonStripePriceLabels,
  catalog: {
    monthlyPrice?: number | null;
    yearlyMonthlyPrice?: number | null;
  },
): AddonStripePriceLabels {
  const catalogMonthly = catalogMonthlyLabel(catalog.monthlyPrice);
  const catalogYearly = catalogYearlyLabels(catalog.yearlyMonthlyPrice);
  return {
    monthlyLabel: catalogMonthly ?? stripe.monthlyLabel,
    yearlyLabel: catalogYearly.yearlyLabel ?? stripe.yearlyLabel,
    yearlyMonthlyEquivalentLabel:
      catalogYearly.yearlyMonthlyEquivalentLabel ??
      stripe.yearlyMonthlyEquivalentLabel,
    monthlyConfigured: stripe.monthlyConfigured,
    yearlyConfigured: stripe.yearlyConfigured,
  };
}
