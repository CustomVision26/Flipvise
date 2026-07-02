import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const PRICING_BILLING_ARTICLES: DocArticle[] = [
  a(
    "pricing",
    "Pricing Page — In-Depth Guide",
    "Compare tiers, billing periods, and start checkout at /pricing.",
    [
      {
        id: "ui",
        title: "Page features",
        bullets: [
          "Toggle monthly vs yearly billing — yearly shows effective monthly rate.",
          "View plans dropdown filters the grid or show all tiers.",
          "Each card lists features, price, and active promo badge when a sale runs.",
          "Promotion code field above plan cards — optional; ?promo= in URL can pre-fill.",
          "Active public codes appear as quick-fill chips during sales.",
          "Signed-in users see Current plan badge and Manage subscription when applicable.",
        ],
      },
      {
        id: "checkout-path",
        title: "Purchase path",
        bullets: [
          "Choose plan → /pricing/checkout review → Stripe Embedded Checkout payment.",
          "Eligible plans may show Start free trial (monthly only) or Subscribe now.",
          "Promos apply to new paid subscriptions only — not trials or plan changes.",
        ],
      },
      {
        id: "free-trial",
        title: "Free trial",
        bullets: [
          "Some plans offer a published free trial (e.g. Pro Plus — 7 days when enabled).",
          "One trial per account — after you use it, only Subscribe now is available.",
          "Trial checkout shows $0 today; you add a payment method on Stripe but are not charged until the trial ends.",
          "You must acknowledge billing terms before sliding to start the trial.",
          "When the trial ends, Stripe charges the monthly rate unless you cancel before then.",
          "Trial ending and expired notices appear in your dashboard inbox (not email).",
        ],
      },
    ],
  ),
  a(
    "stripe-billing-payment",
    "Stripe Billing & Payment — In-Depth Guide",
    "How Flipvise collects payment through Stripe Checkout.",
    [
      {
        id: "checkout",
        title: "Checkout process",
        bullets: [
          "Subscription mode — not a separate in-app card form on pricing.",
          "Billing address required — international/overseas addresses supported.",
          "Stripe Automatic Tax may apply based on address.",
          "Tax ID collection enabled for business customers where supported.",
          "Flipvise does not store full card numbers — Stripe handles PCI compliance.",
        ],
      },
      {
        id: "after-purchase",
        title: "After purchase",
        bullets: [
          "Receipts and invoices in Stripe Customer Portal.",
          "May sync to Flipvise inbox.",
          "Currency follows Stripe Price configuration (typically USD).",
        ],
      },
    ],
  ),
  a(
    "checkout",
    "Checkout Flow — In-Depth Guide",
    "Confirm plan, period, and amount due at /pricing/checkout before payment.",
    [
      {
        id: "new-vs-change",
        title: "New subscription vs plan change",
        bullets: [
          "New subscribers: promo field applies; discount shows on payment step.",
          "Free trial checkout: no promo field — trial terms and acknowledgment checkbox instead.",
          "Existing subscribers: proration preview instead of promo — promos blocked on plan changes.",
          "Slide to confirm → /pricing/checkout/pay or plan-change payment.",
          "Success → /dashboard?checkout=success with confirmation toast.",
        ],
      },
      {
        id: "payment-fields",
        title: "Account vs payment details",
        bullets: [
          "Account email — your signed-in Flipvise address; receipts and billing notices go here.",
          "Payment method — card number, expiry, and CVC for whoever is paying.",
          "Billing address — name and address on the card or bank account you are paying with (not your Flipvise account). Used to verify the payment method and calculate tax where applicable.",
        ],
      },
    ],
  ),
  a(
    "manage-subscription",
    "Manage Subscription — In-Depth Guide",
    "Update payment method, invoices, cancellation, and plan changes outside first purchase.",
    [
      {
        id: "entry-points",
        title: "How to open billing portal",
        bullets: [
          "/pricing — Manage subscription when you have active Stripe subscription.",
          "Account menu → Billing tab — Manage billing and Cancel subscription.",
          "Stripe Customer Portal opens in a new page.",
        ],
      },
      {
        id: "portal-actions",
        title: "Portal actions",
        bullets: [
          "Update card and billing address.",
          "Download invoices.",
          "Cancel at period end.",
          "Plan upgrades/downgrades can also start from /pricing with in-app proration checkout.",
        ],
      },
      {
        id: "failed-renewal-grace",
        title: "Failed renewal grace period",
        bullets: [
          "If a renewal payment fails, you keep paid features for 12 hours while Stripe retries.",
          "A banner and inbox notice show how long you have to fix billing.",
          "Update your payment method via Manage billing or /pricing before grace ends.",
          "If payment is not fixed within 12 hours, your subscription is canceled and your account returns to the Free plan.",
          "Applies to all paid plans (Pro, Pro Plus, and team tiers).",
        ],
      },
    ],
  ),
  a(
    "prorations-plan-changes",
    "Prorations & Plan Changes — In-Depth Guide",
    "Fair billing when switching plans mid-cycle.",
    [
      {
        id: "how",
        title: "How proration works",
        bullets: [
          "Choosing another paid tier routes to plan-change checkout — not a second full subscription.",
          "Credit for unused time on old plan; charge for new plan for remainder of period.",
          "Checkout shows line items and Amount due today.",
          "Previous promo discounts do not carry over — proration only.",
          "Monthly ↔ yearly on same tier also reprices with proration.",
        ],
      },
    ],
  ),
  a(
    "promo-general",
    "General Promotion Codes — In-Depth Guide",
    "Seasonal or campaign discounts configured per plan tier.",
    [
      {
        id: "rules",
        title: "How general promos work",
        bullets: [
          "Each tier can have its own promo: discount %, label, Stripe coupon id, start/end window.",
          "Active sale shows badge and code on plan card and quick-fill chips.",
          "Codes are tier-specific — Pro code on Pro Plus fails.",
          "One redemption per customer per campaign.",
          "Outside the promo window, checkout rejects the code.",
        ],
      },
    ],
  ),
  a(
    "promo-affiliate",
    "Affiliate Promotion Codes — In-Depth Guide",
    "Combined codes linking a tier’s base promo with an affiliate partner.",
    [
      {
        id: "format",
        title: "Code format",
        paragraphs: [
          "Format: {baseCouponId}{affiliateSuffix} — e.g. SummerLaunchusera1276 (no separator between base and suffix).",
        ],
      },
      {
        id: "rules",
        title: "Rules",
        bullets: [
          "Requires both general and affiliate discounts active in the tier’s promo window.",
          "Affiliate must be an active marketing partner.",
          "New subscription only — same once-per-campaign redemption as general promos.",
          "Successful checkouts record affiliateId in subscription metadata.",
        ],
      },
    ],
  ),
  a(
    "promo-seasonal-by-plan",
    "Seasonal Promos by Plan — In-Depth Guide",
    "Why some plans show a sale while others do not.",
    [
      {
        id: "per-plan",
        title: "Per-plan configuration",
        bullets: [
          "Promotions are per plan — Pro can run a sale while Pro Plus has none.",
          "Each tier needs discount.active, stripeCouponId, promoStartsAt, promoEndsAt.",
          "Affiliate discounts share the same schedule window as the tier’s general promo.",
          "When a season ends, codes stop working automatically.",
          "Team tiers may have no promo — full price unless admin adds a future season.",
        ],
      },
      {
        id: "verify",
        title: "Always verify on /pricing",
        paragraphs: [
          "Do not assume one site-wide coupon works on every tier. Check each plan card for badges before sharing codes from old emails.",
        ],
      },
    ],
  ),
];
