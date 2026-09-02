import { resolveStripePublishableKey } from "@/lib/stripe-publishable-key";

/** Matches formal Stripe-hosted Checkout styling (light page, navy accent). */
export const STRIPE_CHECKOUT_PAGE_BG = "#f6f7f9";
export const STRIPE_CHECKOUT_NAVY = "#1a2332";
export const STRIPE_CHECKOUT_TEXT = "#30313d";

export const STRIPE_CHECKOUT_ELEMENTS_APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: STRIPE_CHECKOUT_NAVY,
    colorBackground: "#ffffff",
    colorText: STRIPE_CHECKOUT_TEXT,
    colorDanger: "#df1b41",
    fontFamily: 'Georgia, "Noto Serif", serif',
    borderRadius: "4px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #e0e4e8",
      boxShadow: "none",
    },
    ".Label": {
      fontWeight: "500",
    },
  },
};

/** Shown under Payment method — Stripe ranks eligible options per customer. */
export const STRIPE_CHECKOUT_PAYMENT_METHODS_HELP =
  "Pay with a card, Apple Pay, Google Pay, Link, or a US bank account (ACH). Stripe shows the methods available for your location and device.";

/** Let Payment Element offer wallets instead of a card-only form. */
export const STRIPE_CHECKOUT_PAYMENT_ELEMENT_WALLETS = {
  applePay: "auto",
  googlePay: "auto",
  link: "auto",
} as const;

export function isStripeTestModeClient(publishableKey?: string | null): boolean {
  const key =
    publishableKey?.trim() ||
    resolveStripePublishableKey() ||
    "";
  return key.startsWith("pk_test_");
}
