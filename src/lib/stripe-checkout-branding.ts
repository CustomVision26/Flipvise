import type Stripe from "stripe";
import { resolveLogoImageUrl } from "@/lib/branding";

/** Light neutral page — traditional invoice / billing feel. */
const CHECKOUT_BACKGROUND_COLOR = "#f6f7f9";
/** Navy CTA — restrained, formal contrast on light background. */
const CHECKOUT_BUTTON_COLOR = "#1a2332";

function absoluteLogoUrlForCheckout(): string | null {
  const url = resolveLogoImageUrl().trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return null;
  }
  return url;
}

/**
 * Formal hosted Checkout presentation: light layout, rectangular fields,
 * professional typography. Do not pass payment_method_types — Stripe dynamic
 * methods (cards, wallets, Link, ACH) come from the Dashboard.
 */
export function stripeCheckoutBrandingParams(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "branding_settings" | "custom_text"
> {
  const logoUrl = absoluteLogoUrlForCheckout();

  return {
    branding_settings: {
      display_name: "Flipvise",
      background_color: CHECKOUT_BACKGROUND_COLOR,
      button_color: CHECKOUT_BUTTON_COLOR,
      border_style: "rectangular",
      font_family: "noto_serif",
      ...(logoUrl
        ? {
            logo: {
              type: "url" as const,
              url: logoUrl,
            },
          }
        : {}),
    },
    custom_text: {
      submit: {
        message: "Complete subscription",
      },
    },
  };
}

/**
 * On-site Checkout (`ui_mode: elements`). Omit payment_method_types so Stripe
 * can offer cards, Apple Pay, Google Pay, Link, and ACH when those methods are
 * enabled in the Dashboard.
 */
export function stripeCheckoutElementsSessionParams(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "ui_mode"
> {
  return {
    ui_mode: "elements" as Stripe.Checkout.SessionCreateParams["ui_mode"],
  };
}

/** @deprecated Use `stripeCheckoutElementsSessionParams` */
export const stripeCheckoutCustomSessionParams = stripeCheckoutElementsSessionParams;
