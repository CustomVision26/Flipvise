import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeAddonPriceLabelsWithCatalog } from "./addon-catalog-price-labels";
import type { AddonStripePriceLabels } from "./addon-catalog-price-labels";

const emptyStripe: AddonStripePriceLabels = {
  monthlyLabel: null,
  yearlyLabel: null,
  yearlyMonthlyEquivalentLabel: null,
  monthlyConfigured: true,
  yearlyConfigured: true,
};

describe("mergeAddonPriceLabelsWithCatalog", () => {
  it("uses Addon Plans amounts when Stripe retrieve failed", () => {
    const merged = mergeAddonPriceLabelsWithCatalog(emptyStripe, {
      monthlyPrice: 12.99,
      yearlyMonthlyPrice: 120,
    });
    assert.equal(merged.monthlyLabel, "$12.99/mo");
    assert.equal(merged.yearlyLabel, "$1,440.00/yr");
    assert.equal(merged.yearlyMonthlyEquivalentLabel, "$120.00/mo");
    assert.equal(merged.monthlyConfigured, true);
    assert.equal(merged.yearlyConfigured, true);
  });

  it("prefers catalog amounts over Stripe labels", () => {
    const merged = mergeAddonPriceLabelsWithCatalog(
      {
        ...emptyStripe,
        monthlyLabel: "$19.99/mo",
        yearlyLabel: "$199.00/yr",
        yearlyMonthlyEquivalentLabel: "$16.58/mo",
      },
      { monthlyPrice: 12.99, yearlyMonthlyPrice: 120 },
    );
    assert.equal(merged.monthlyLabel, "$12.99/mo");
    assert.equal(merged.yearlyLabel, "$1,440.00/yr");
  });
});
