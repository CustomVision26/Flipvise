import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const AFFILIATE_PORTAL_ARTICLES: DocArticle[] = [
  a(
    "affiliate-dashboard",
    "Affiliate Portal — In-Depth Guide",
    "Self-service dashboard for active marketing affiliates at /dashboard/affiliate.",
    [
      {
        id: "access",
        title: "Access requirements",
        bullets: [
          "Active marketing affiliate arrangement (accepted invite, status active).",
          "Signed in with the email tied to the invite.",
          "Header Affiliate link appears when qualified.",
          "Non-affiliates redirected to /dashboard.",
        ],
      },
      {
        id: "kpis",
        title: "KPI cards",
        table: {
          headers: ["Card", "Meaning"],
          rows: [
            ["Total paid subscriptions", "Lifetime paid referrals via your combined codes"],
            ["This month", "Paid referrals in current calendar month"],
            ["Your plan grant", "Complimentary plan while arrangement is active"],
          ],
        },
      },
      {
        id: "arrangement",
        title: "Arrangement — plan period",
        bullets: [
          "Status badge shows Active while current.",
          "Started and Ends dates for complimentary access.",
          "Optional referral quota: progress toward paid subscriptions needed to auto-renew next period.",
        ],
      },
      {
        id: "promo-codes",
        title: "Promotion codes",
        bullets: [
          "Your affiliate suffix combines with each active tier promo: {baseCouponId}{suffix}.",
          "Active codes tab — plan, combined code, affiliate %, valid through, Copy button.",
          "History tab — expired promotions grouped by campaign and date range.",
          "Customers enter combined code on /pricing before subscribing.",
        ],
      },
      {
        id: "attribution",
        title: "How attribution works",
        paragraphs: [
          "Flipvise records a paid referral when someone completes Stripe subscription checkout with your combined code. Totals update after successful payment — not on page visits or sign-ups alone.",
        ],
      },
      {
        id: "dos-donts",
        title: "Do’s and don’ts",
        bullets: [
          "Share codes only through approved marketing channels.",
          "Use Copy for exact strings — avoid manual typos.",
          "Do not share codes outside approved channels.",
          "Confirm arrangement changes promptly when admin updates plan or end date.",
        ],
      },
    ],
  ),
];
