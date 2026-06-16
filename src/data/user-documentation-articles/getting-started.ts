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
        title: "Signing in and signing up",
        bullets: [
          "Sign In and Sign Up open Clerk in modal mode — you stay on the homepage overlay.",
          "Use the same email address that appears on team or affiliate invites.",
          "If you arrived from an invite link, the flow may return you to that invite after authentication.",
        ],
      },
      {
        id: "guest-nav",
        title: "Guest navigation",
        bullets: [
          "Pricing — compare plans and start checkout after sign-in.",
          "Documentation — opens this user guide at /docs.",
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
            ["Documentation", "Yes", "Yes"],
            ["Contact Us", "Top nav link", "Use /contact or inbox"],
            ["Help Center", "Docs section", "Docs section + /contact"],
            ["Plan label", "Hidden", "Shows effective plan"],
            ["Workspace switcher", "Hidden", "Personal + team workspaces"],
            ["Inbox", "Hidden", "Badge when unread items"],
            ["Affiliate link", "Hidden", "When active affiliate"],
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
          "To Admin Dash — opens Team Admin for owners and co-admins.",
          "Switching workspaces updates URL query params and a team context cookie.",
        ],
      },
      {
        id: "help-inbox",
        title: "Support and inbox",
        bullets: [
          "Help Center ticket categories and workflows are documented under Help Center in this guide; use Contact Us (/contact) for live chat.",
          "Inbox aggregates invites, billing, quiz results, affiliate messages, and Contact Us replies.",
          "Badge count reflects actionable unread items.",
        ],
      },
    ],
  ),
];
