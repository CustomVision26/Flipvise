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
 * Checkout keeps cards (including Apple Pay / Google Pay), Link, and ACH.
 * Everything else Stripe might surface from the Dashboard is excluded.
 */
const STRIPE_CHECKOUT_ALLOWED_DYNAMIC_TYPES = new Set<string>([
  "card",
  "us_bank_account",
]);

const STRIPE_CHECKOUT_EXCLUDABLE_PAYMENT_METHOD_TYPES: Stripe.Checkout.SessionCreateParams.ExcludedPaymentMethodType[] =
  [
    "acss_debit",
    "affirm",
    "afterpay_clearpay",
    "alipay",
    "alma",
    "amazon_pay",
    "au_becs_debit",
    "bacs_debit",
    "bancontact",
    "billie",
    "blik",
    "boleto",
    "cashapp",
    "crypto",
    "customer_balance",
    "eps",
    "fpx",
    "giropay",
    "grabpay",
    "ideal",
    "kakao_pay",
    "klarna",
    "konbini",
    "kr_card",
    "mb_way",
    "mobilepay",
    "multibanco",
    "naver_pay",
    "nz_bank_account",
    "oxxo",
    "p24",
    "pay_by_bank",
    "payco",
    "paynow",
    "paypal",
    "payto",
    "pix",
    "promptpay",
    "revolut_pay",
    "samsung_pay",
    "satispay",
    "sepa_debit",
    "sofort",
    "sunbit",
    "swish",
    "twint",
    "upi",
    "wechat_pay",
    "zip",
  ];

export const STRIPE_CHECKOUT_EXCLUDED_PAYMENT_METHOD_TYPES =
  STRIPE_CHECKOUT_EXCLUDABLE_PAYMENT_METHOD_TYPES.filter(
    (type) => !STRIPE_CHECKOUT_ALLOWED_DYNAMIC_TYPES.has(type),
  );

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
  "ui_mode" | "excluded_payment_method_types"
> {
  return {
    ui_mode: "elements" as Stripe.Checkout.SessionCreateParams["ui_mode"],
    excluded_payment_method_types: STRIPE_CHECKOUT_EXCLUDED_PAYMENT_METHOD_TYPES,
  };
}

/** @deprecated Use `stripeCheckoutElementsSessionParams` */
export const stripeCheckoutCustomSessionParams = stripeCheckoutElementsSessionParams;
