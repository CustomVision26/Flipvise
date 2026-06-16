import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const CONTACT_US_ARTICLES: DocArticle[] = [
  a(
    "contact-us-page",
    "Contact Support Page — In-Depth Guide",
    "The public Contact Us page (/contact) starts live conversations with Flipvise administrators.",
    [
      {
        id: "form",
        title: "Starting a conversation",
        bullets: [
          "Fill Name, Email, Subject, and Message (minimum 10 characters).",
          "Click Start conversation — you are redirected to /contact/thread/[messageId].",
          "Name and Email pre-fill when signed in from your Clerk profile.",
        ],
      },
      {
        id: "cards",
        title: "Page sections",
        bullets: [
          "Contact details — support inbox, optional phone, social links.",
          "In-app Help Center card — links to categorized tickets for signed-in users.",
          "Documentation card — links to this user guide.",
        ],
      },
      {
        id: "nav",
        title: "Navigation note",
        paragraphs: [
          "Contact Us appears in the top nav for guests. Signed-in users reach /contact via direct URL, documentation, or inbox notifications.",
        ],
      },
    ],
  ),
  a(
    "contact-us-live-chat",
    "Live Conversation Thread — In-Depth Guide",
    "Real-time-style chat after submitting Contact Us at /contact/thread/[messageId].",
    [
      {
        id: "ui",
        title: "Thread interface",
        bullets: [
          "Header shows subject and status: Open, In progress, or Archived.",
          "Original message at top; replies in chronological order.",
          "Administrator replies labeled “Support team” with distinct styling.",
          "Reply to support and Send message to continue.",
        ],
      },
      {
        id: "updates",
        title: "Updates",
        bullets: [
          "Thread refreshes every few seconds while open (polling, not WebSockets).",
          "Updating… indicator appears during background refresh.",
          "Archived conversations show a notice and block new messages.",
        ],
      },
      {
        id: "access",
        title: "Access requirements",
        bullets: [
          "Guests need the ?token= from redirect URL — bookmark the full link.",
          "Signed-in users access owned threads without the token.",
          "Do not share thread URLs — anyone with the token can read and reply.",
        ],
      },
    ],
  ),
  a(
    "contact-us-guest-vs-signed-in",
    "Guests vs Signed-In Users — In-Depth Guide",
    "How Contact Us access and notifications differ by authentication state.",
    [
      {
        id: "guests",
        title: "Guests",
        bullets: [
          "Submit with any name and email — no sign-in required.",
          "Receive thread URL with private ?token= — save it to return.",
          "No inbox notifications — check the thread page for replies.",
        ],
      },
      {
        id: "signed-in",
        title: "Signed-in users",
        bullets: [
          "Threads linked to Clerk user ID.",
          "Inbox shows “Support replied: …” when admin responds.",
          "Open thread without token when you own the message.",
        ],
      },
    ],
  ),
  a(
    "contact-us-vs-help-center",
    "Contact Us vs Help Center — In-Depth Guide",
    "Choose the right support channel for your situation.",
    [
      {
        id: "comparison",
        title: "Channel comparison",
        table: {
          headers: ["", "Contact Us", "Help Center"],
          rows: [
            ["URL", "/contact", "Header ? icon"],
            ["Guests", "Yes", "No — sign in required"],
            ["Format", "Live chat thread", "Categorized tickets"],
            ["Attachments", "Text only", "Screenshots supported"],
            ["Priority Support", "No", "Yes (Pro Plus / team tier)"],
            ["Tracking", "Thread URL / inbox", "My tickets with resolve/reopen"],
          ],
        },
      },
      {
        id: "guidance",
        title: "When to use which",
        bullets: [
          "Contact Us — quick live conversation, especially when not signed in.",
          "Help Center — structured bug reports, billing disputes, ticket workflow.",
          "Do not duplicate the same issue in both channels.",
        ],
      },
    ],
  ),
];
