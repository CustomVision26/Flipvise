import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const INBOX_ARTICLES: DocArticle[] = [
  a(
    "inbox",
    "Inbox — In-Depth Guide",
    "The inbox (/dashboard/inbox) is Flipvise’s unified notification center for actionable and historical messages.",
    [
      {
        id: "tabs",
        title: "Inbox vs History",
        bullets: [
          "Inbox tab — unread and actionable items requiring your attention.",
          "History tab — completed, read, or archived notifications.",
          "Header badge shows pending inbox count.",
        ],
      },
      {
        id: "message-types",
        title: "Message types",
        table: {
          headers: ["Type", "Typical action"],
          rows: [
            ["Team invite", "Accept or decline workspace membership"],
            ["Affiliate invite / arrangement change", "Accept invite or confirm plan change"],
            ["Billing / Stripe receipt", "Review charge or open portal"],
            ["Quiz result", "Open full attempt breakdown"],
            ["Affiliate broadcast", "Read promo announcements from admin"],
            ["Contact Us reply", "Open live chat thread"],
            ["Plan assignment invite", "Accept admin-granted plan change"],
            ["Welcome message", "Read your one-time getting-started guide"],
          ],
        },
      },
      {
        id: "tips",
        title: "Best practices",
        bullets: [
          "Accept team invites before they expire — request a resend from your admin if needed.",
          "Keep affiliate and plan-assignment emails until you complete acceptance.",
          "Contact Us replies appear as “Support replied: …” with a link to the thread.",
        ],
      },
    ],
  ),
];
