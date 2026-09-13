import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const GETTING_STARTED_ARTICLES: DocArticle[] = [
  a(
    "homepage",
    "Homepage — In-Depth Guide",
    "The homepage is Flipvise’s public entry point and the only place where sign-in and sign-up are started. There is no separate /sign-in route.",
    [
      {
        id: "role",
        title: "What the homepage is for",
        paragraphs: [
          "Guests use the homepage to learn about Flipvise, browse pricing, read documentation, and open authentication.",
          "Signed-in users who visit / are typically redirected to their dashboard automatically.",
        ],
      },
      {
        id: "sign-in",
        title: "Signing in",
        bullets: [
          "Sign In opens a modal on the homepage. You can continue with email and password, Apple, Google, or an email verification code.",
          "Open sign-in steps to follow the screenshots in order. The guide stays open if you leave this page — close it only when you are finished.",
          "Use the same email address that appears on team or affiliate invites.",
          "If you arrived from an invite link, the flow may return you to that invite after authentication.",
        ],
      },
      {
        id: "sign-up",
        title: "Signing up",
        bullets: [
          "Sign Up opens the Flipvise account form: name, email, password, and password confirmation.",
          "After email verification, complete contact details, account type, and security questions. The dashboard unlocks when those steps are saved.",
          "Open sign-up guide to walk through every screenshot in order, like a Flipvise UI guide. You may navigate anywhere in Flipvise while it remains open. UI Guides in the header also includes Create a deck after you have an account.",
        ],
      },
      {
        id: "guest-nav",
        title: "Guest navigation",
        bullets: [
          "Plans — compare tiers and start checkout after sign-in (header link to Plans & Pricing).",
          "Documentation — opens this user guide.",
          "Contact Us — public live chat for guests (also linked from the nav on guest pages).",
        ],
      },
      {
        id: "redirects",
        title: "Redirects and deep links",
        bullets: [
          "Protected pages redirect unauthenticated users to / with a return URL.",
          "Team invite links (/invite/team/…) and affiliate accept links (/affiliate/accept) require sign-in before completion.",
          "Never bookmark /sign-in — that route does not exist in this app.",
        ],
      },
    ],
  ),
  a(
    "header-navigation",
    "Top Navigation Bar — In-Depth Guide",
    "The header is persistent across most signed-in pages and adapts between guest and authenticated layouts.",
    [
      {
        id: "guest-vs-signed-in",
        title: "Guest vs signed-in header",
        table: {
          headers: ["Element", "Guests", "Signed-in users"],
          rows: [
            ["Home", "Homepage", "Personal dashboard"],
            ["Documentation", "Top nav pill", "Book icon (right, beside Help)"],
            ["Plans", "Top nav pill to Plans & Pricing", "Plans button + plan label (both open Plans & Pricing)"],
            ["Contact Us", "Top nav link", "Use Contact Us or inbox"],
            ["Help Center", "Docs section", "Docs section + /contact"],
            ["Plan label", "Hidden", "Shows effective plan"],
            ["Workspace switcher", "Hidden", "Personal + team workspaces"],
            ["Inbox", "Hidden", "Badge when unread items"],
            ["Affiliate link", "Hidden", "When active affiliate"],
            ["UI Guides", "Top nav button — all visual walkthroughs", "Header button (right, beside Inbox) — all visual walkthroughs"],
            ["Account menu", "Sign in/up", "Clerk profile + custom tabs"],
          ],
        },
      },
      {
        id: "workspace-switcher",
        title: "Workspace switcher",
        bullets: [
          "Personal Dash — your own decks and account context.",
          "Team workspaces — study or manage decks in a subscriber’s workspace.",
          "WS Admin Dash — opens Team Admin for co-admins on invited workspaces (tooltip: This Workspace Admin Dashboard).",
          "Switching workspaces updates a team context cookie. Personal Dash is /dashboard; invited workspaces use /dashboard?team=<id> without Clerk user ids in the URL.",
        ],
      },
      {
        id: "help-inbox",
        title: "Support and inbox",
        bullets: [
          "Documentation — book icon on the right of the header (beside Help and Inbox).",
          "UI Guides — header button that lists every Flipvise UI guide (sign-up, sign-in, Personal Dashboard, Pricing, Subscribe, and Create a deck). Choose one to open the walkthrough; it stays open while you browse.",
          "Plans — signed-in header button (and your plan label) open Plans & Pricing.",
          "Help Center ticket categories and workflows are documented under Help Center in this guide; use Contact Us (/contact) for live chat.",
          "Inbox aggregates invites, billing, quiz results, affiliate messages, and Contact Us replies.",
          "Badge count reflects actionable unread items.",
        ],
      },
    ],
  ),
];
