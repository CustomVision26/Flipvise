import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatStripeInvoiceLineDescription } from "./stripe-invoice-trial-line";

describe("formatStripeInvoiceLineDescription", () => {
  it("leaves paid subscription lines unchanged", () => {
    assert.equal(
      formatStripeInvoiceLineDescription({
        description: "1 × Pro Plus (at $40.00 / month)",
        amountCents: 4000,
      }),
      "1 × Pro Plus (at $40.00 / month)",
    );
  });

  it("adds trial length and end date to Stripe free-trial wording", () => {
    const trialStartSeconds = Date.UTC(2026, 8, 3, 12) / 1000;
    const trialEndSeconds = Date.UTC(2026, 8, 10, 12) / 1000;
    assert.equal(
      formatStripeInvoiceLineDescription({
        description: "Free trial for 1 × Pro Plus",
        amountCents: 0,
        trialStartSeconds,
        trialEndSeconds,
      }),
      "7-day free trial for 1 × Pro Plus (ends September 10, 2026)",
    );
  });

  it("treats a $0 line with a known trial end as a trial even without Free trial prefix", () => {
    const trialStartSeconds = Date.UTC(2026, 8, 3, 12) / 1000;
    const trialEndSeconds = Date.UTC(2026, 8, 10, 12) / 1000;
    assert.equal(
      formatStripeInvoiceLineDescription({
        description: "1 × Pro Plus",
        amountCents: 0,
        trialStartSeconds,
        trialEndSeconds,
      }),
      "7-day free trial for 1 × Pro Plus (ends September 10, 2026)",
    );
  });
});
