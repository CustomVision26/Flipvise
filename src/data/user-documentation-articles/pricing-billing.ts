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
          "Open pricing guide to follow the screenshots in order. The guide stays open if you leave this page — close it only when you are finished. UI Guides in the header also lists Create a deck, Subscribe, and deck editor card walkthroughs.",
          "Toggle monthly vs yearly billing — yearly shows effective monthly rate.",
          "View plans dropdown filters the grid or show all tiers.",
          "Consumer tiers: Free, Pro, Pro Plus, Team Basic, Team Gold, Platinum, Enterprise.",
          "Education tiers: Education Plus, Education Gold, Education Enterprise.",
          "Each card lists features, price, and active promo badge when a sale runs.",
          "Promotion code field above plan cards — optional; ?promo= in URL can pre-fill.",
          "Active public codes appear as quick-fill chips during sales.",
          "Signed-in users see Current plan badge and Manage subscription when applicable.",
          "When published, an Add-on Catalog link leads to optional features such as AI Essay.",
        ],
      },
      {
        id: "checkout-path",
        title: "Purchase path",
        bullets: [
          "Open subscribe guide to walk through choosing a plan, Stripe checkout, Inbox confirmation, and the Flipvise receipt. The guide stays open while you browse.",
          "Choose plan → /pricing/checkout review → Stripe Embedded Checkout on /pricing/checkout/pay.",
          "Pay URLs do not include Stripe session ids or Clerk user ids; the session is stored in an httpOnly cookie.",
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
          "Trial checkout shows $0 today; you add a payment method on Stripe but are not charged until the trial ends. The Flipvise receipt lists the trial length (for example 7 days) and the end date.",
          "You must acknowledge billing terms before sliding to start the trial.",
          "When the trial ends, Stripe charges the monthly rate unless you cancel before then.",
          "Trial ending and expired notices appear in your dashboard inbox (not email).",
        ],
      },
    ],
  ),
  a(
    "pricing-add-ons",
    "Add-on Catalog — In-Depth Guide",
    "Optional premium add-ons stack on your current plan. They are not separate subscriptions.",
    [
      {
        id: "purchase",
        title: "Buying an add-on",
        bullets: [
          "The catalog is visible when it is published. Each card shows monthly and yearly amounts when both are offered.",
          "Guests can browse prices and sign in to purchase. Unlock Feature in the dashboard banner uses the same checkout.",
          "Choose monthly or yearly when a yearly price is offered.",
          "If you are signed in on a plan that cannot buy that add-on, View eligible plans takes you to Pricing.",
          "Checkout opens an add-on subscription that stacks on your base plan. The pay page is /pricing/add-ons/pay without a Stripe session id in the address bar.",
          "Plan-change checkout can offer locked published add-ons in a dialog before payment.",
          "Live Classroom™ is an organization add-on for Team and Enterprise plans — purchased by the subscription owner; participant limits follow licensed seats.",
          "Complimentary Pro Plus still counts for add-ons that list Pro Plus. Team-only add-ons such as Live Classroom still need a team or education team plan.",
        ],
      },
      {
        id: "ai-essay",
        title: "AI Essay",
        bullets: [
          "AI Essay unlocks generation, drafts, submissions, and AI feedback after purchase or grant.",
          "Open it from the add-ons banner on your dashboard (or from Teacher Dashboard tools when the add-on is unlocked).",
          "How it work? in the header opens a short workflow dialog with a link to this Add-on Catalog guide.",
          "Overview shows recent essays and recent AI feedback with counts and date/time stamps, plus continue draft, generate, and assignments.",
          "Generate Essay: subject, grade, type, difficulty, topic, optional learning standard, word count, timer, and include flags.",
          "My Essays, Drafts, and Assignments keep generated activities, open drafts, and Team Admin assignments.",
          "Writing workspace: prompt, instructions, word counter, optional timer, save, submit, and AI feedback. The model essay stays hidden until you reveal it.",
        ],
      },
      {
        id: "ai-essay-access",
        title: "How AI Essay access is granted",
        bullets: [
          "Purchase from the Add-on Catalog or Unlock Feature (monthly or yearly). Eligible plans include Pro, Pro Plus, team, and education plans.",
          "Workspace member assignment is coming soon; members see Coming soon instead of unlock.",
          "Flipvise can also grant complimentary access.",
        ],
      },
      {
        id: "ai-essay-offline",
        title: "AI Essay offline",
        bullets: [
          "Prompts and writing remain usable offline; drafts cache on your device and sync when you are back online.",
          "AI generation and AI feedback need an internet connection.",
        ],
      },
      {
        id: "other-grants",
        title: "Other ways to unlock",
        bullets: [
          "Team Admin → Add-ons will assign member add-ons later; AI Essay member assignment is coming soon (plan owner personal use only for now).",
          "Flipvise can grant complimentary access.",
          "Live Classroom™ organization ownership is granted to the subscription owner (purchase or complimentary grant).",
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
          "Billing address required — international/overseas addresses supported (state / province / parish).",
          "Stripe Automatic Tax may apply based on address.",
          "Tax ID collection enabled for business customers where supported.",
          "Flipvise does not store full card or bank numbers — Stripe handles PCI compliance.",
          "Checkout does not lock to cards. Stripe can offer cards, Apple Pay, Google Pay, Link, and US bank account (ACH) from Dashboard payment-method settings.",
          "A Stripe test card on the public checkout is rewritten to a formal alert: test card numbers are not accepted; use a genuine bank-issued card.",
        ],
      },
      {
        id: "after-purchase",
        title: "After purchase",
        bullets: [
          "Flipvise receipts in Inbox and Billing show Flipvise Studio LLC and the company mailing address (street, city, and phone — no apartment). Each receipt lists the plan start date, plan end date, and whether auto-renewal is On or Off, and closes with Regards, Flipvise Team by Flipvise Studio LLC. Free-trial line items include the trial length and the date the trial ends. Stripe Customer Portal PDFs still use Stripe Dashboard public details for their header.",
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
          "Open subscribe guide to follow choosing a plan, Stripe checkout, and opening your receipt. UI Guides in the header also lists Create a deck and deck editor card walkthroughs.",
          "New subscribers: promo field applies; discount shows on payment step.",
          "Free trial checkout: no promo field — trial terms and acknowledgment checkbox instead.",
          "Existing subscribers: proration preview instead of promo — promos blocked on plan changes.",
          "Plan change + published Add-on Catalog: dialog lists locked add-ons only; skip or select one, review plan + add-on breakdown, then continue.",
          "Selected add-on: after plan-change payment, a continue bridge finalizes the plan then opens add-on checkout in the same session (two receipts).",
          "Promotion code field only when Pricing has an active promo window; hidden on plan change when Pricing shows no promo UI.",
          "Success → personal dashboard with confirmation toast; Inbox receives a formal plan or plan-change confirmation.",
          "Add-on checkout (catalog or Unlock Feature) also returns to the personal dashboard with an add-on toast and a formal Inbox confirmation.",
        ],
      },
      {
        id: "payment-fields",
        title: "Account vs payment details",
        bullets: [
          "Account email — your signed-in Flipvise address; receipts and billing notices go here.",
          "Payment method — card, Apple Pay, Google Pay, Link, or US bank account (ACH), depending on what Stripe shows for your location and device.",
          "Billing address — name and address on the card or bank account you are paying with. When you have a complete Flipvise mailing address in Account Details, Same as my Flipvise mailing address is selected by default so country/address fields stay hidden and you enter Name on payment method only. Uncheck it to enter a different billing address (state / province / parish). Used to verify the payment method and calculate tax where applicable.",
          "If a Stripe test card number is entered on the public checkout, a formal red alert explains that test card numbers are not accepted and a genuine bank-issued card is required. Stripe’s technical wording is not shown.",
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
          "Download Stripe invoices from the portal, or open Flipvise receipts from Billing plan history and Inbox (seller address from Contact Us; plan start, plan end, and auto-renewal On or Off).",
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
          "Optional locked add-on (when catalog is published): review plan proration + add-on list price, then complete plan change and a separate add-on checkout without a Stripe session id in the URL.",
          "Previous promo discounts do not carry over — proration only.",
          "Monthly ↔ yearly on same tier also reprices with proration.",
          "If confirmation runs again after Stripe already has the new plan, Flipvise records success instead of showing “You are already on this plan.”",
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
  a(
    "education-plans",
    "Education Plans — In-Depth Guide",
    "Teacher-focused tiers that extend Pro Plus or team workspace features with AI classroom tools.",
    [
      {
        id: "tiers",
        title: "Education tier comparison",
        table: {
          headers: ["Slug", "Display name", "Key additions"],
          rows: [
            ["education_plus", "Education Plus", "Pro Plus + Teacher Dashboard AI tools + Format Quiz Question on personal decks"],
            ["education_gold", "Education Gold", "Team Gold + Education Plus + teacher collaboration"],
            ["education_enterprise", "Education Enterprise", "Enterprise + Education Gold + school admin"],
          ],
        },
      },
      {
        id: "teacher-tools",
        title: "Teacher Dashboard tools (Education Plus+)",
        bullets: [
          "AI Lesson Builder, Quiz/Test Generator, Homework, Study Guides, Worksheets.",
          "Classes, Student Progress, Teacher Resource Library.",
          "Education Plus personal Study → Quiz: Format Quiz Question (formats, counts, time limit, publish) — same as Pro Plus personal decks.",
          "Education Gold: shared lesson library, department workspace, teacher analytics.",
          "Education Enterprise: school administration, multi-campus, curriculum management, school branding.",
        ],
      },
      {
        id: "deck-ownership",
        title: "Deck ownership on education team plans",
        bullets: [
          "Education Plus: create decks on personal dashboard; link in teacher tools.",
          "Education Gold/Enterprise team admins: create decks for assigned workspaces.",
          "Team-owned decks appear on the plan owner's personal dashboard grouped by workspace.",
          "Only the deck creator can edit or delete team dashboard decks.",
        ],
      },
      {
        id: "limits",
        title: "Workspace limits",
        table: {
          headers: ["Plan", "Workspaces", "Members per workspace"],
          rows: [
            ["Education Plus", "Personal only", "N/A"],
            ["Education Gold", "10", "25"],
            ["Education Enterprise", "30", "45"],
          ],
        },
      },
    ],
  ),
];
