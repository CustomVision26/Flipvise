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
 * Formal hosted Checkout presentation: classic card form (no Link wallet),
 * light layout, rectangular fields, professional typography.
 */
export function stripeCheckoutBrandingParams(): Pick<
  Stripe.Checkout.SessionCreateParams,
  | "branding_settings"
  | "custom_text"
  | "wallet_options"
  | "payment_method_types"
> {
  const logoUrl = absoluteLogoUrlForCheckout();

  return {
    payment_method_types: ["card"],
    wallet_options: {
      link: {
        display: "never",
      },
    },
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

/** On-site Checkout (`ui_mode: elements`) — card only, no Link; branding via Elements appearance. */
export function stripeCheckoutElementsSessionParams(): Pick<
  Stripe.Checkout.SessionCreateParams,
  "ui_mode" | "payment_method_types" | "wallet_options"
> {
  return {
    ui_mode: "elements" as Stripe.Checkout.SessionCreateParams["ui_mode"],
    payment_method_types: ["card"],
    wallet_options: {
      link: {
        display: "never",
      },
    },
  };
}

/** @deprecated Use `stripeCheckoutElementsSessionParams` */
export const stripeCheckoutCustomSessionParams = stripeCheckoutElementsSessionParams;
