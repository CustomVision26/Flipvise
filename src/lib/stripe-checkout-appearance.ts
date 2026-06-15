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

export function isStripeTestModeClient(): boolean {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  return key.startsWith("pk_test_");
}
