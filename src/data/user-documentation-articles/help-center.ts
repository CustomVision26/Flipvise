import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const HELP_CENTER_ARTICLES: DocArticle[] = [
  a(
    "help-center-overview",
    "Help Center Overview — In-Depth Guide",
    "The Help Center covers categorized support tickets for signed-in users — see this guide for categories, requirements, and My tickets.",
    [
      {
        id: "navigation",
        title: "Navigating the sheet",
        bullets: [
          "Landing screen lists every ticket category — tap a row to open its form.",
          "← Back in the sheet header returns to the category list.",
          "Closing the sheet resets to the landing screen.",
          "After submit you see confirmation and can submit another request.",
        ],
      },
      {
        id: "visibility",
        title: "When Help Center is visible",
        bullets: [
          "Available for signed-in users on personal workspace and most paid plans.",
          "Hidden for plain team members while actively viewing a team workspace — ask your admin or email support.",
          "Guests should use Contact Us (/contact) for live chat instead.",
        ],
      },
    ],
  ),
  a(
    "help-center-support",
    "Support Ticket — In-Depth Guide",
    "General help for how-to questions and unexpected behaviour not covered by other categories.",
    [
      {
        id: "fields",
        title: "Form fields",
        bullets: [
          "Subject (required).",
          "Message (required, minimum 10 characters).",
          "Optional screenshot — JPEG, PNG, WebP, or GIF up to 10 MB.",
        ],
      },
      {
        id: "when-to-use",
        title: "When to use Support",
        bullets: [
          "How-to questions about Flipvise features.",
          "Unexpected behaviour that does not fit Billing, Account, or Bug Report.",
          "Not for subscription charges — use Billing tab.",
        ],
      },
    ],
  ),
  a(
    "help-center-bug-report",
    "Bug Report — In-Depth Guide",
    "Structured reports for broken behaviour, errors, or data problems.",
    [
      {
        id: "fields",
        title: "Form fields",
        bullets: [
          "Bug Summary (required).",
          "Severity: Low, Normal, High, or Urgent.",
          "Steps to Reproduce (required, min 10 characters) — use numbered steps.",
          "Optional screenshot strongly recommended for UI bugs.",
        ],
      },
      {
        id: "severity",
        title: "Choosing severity",
        table: {
          headers: ["Level", "Use when"],
          rows: [
            ["Low", "Cosmetic issues"],
            ["Normal", "Partial functionality affected"],
            ["High", "Feature blocked"],
            ["Urgent", "App broken or possible data loss"],
          ],
        },
      },
    ],
  ),
  a(
    "help-center-feature-request",
    "Feature Request — In-Depth Guide",
    "Suggest new capabilities or improvements to existing features.",
    [
      {
        id: "fields",
        title: "Form fields",
        bullets: [
          "Feature Title (required).",
          "Description & Use-case (required, min 10 characters) — explain who benefits.",
          "Optional mockup or reference image.",
        ],
      },
      {
        id: "expectations",
        title: "What to expect",
        paragraphs: [
          "Requests are reviewed but not guaranteed to ship. Broken behaviour should use Bug Report instead.",
        ],
      },
    ],
  ),
  a(
    "help-center-feedback",
    "Feedback — In-Depth Guide",
    "Share overall experience, satisfaction, and qualitative thoughts.",
    [
      {
        id: "fields",
        title: "Form fields",
        bullets: [
          "Overall Rating — 1–5 stars (optional, included in ticket message).",
          "Subject — defaults to “App Feedback”.",
          "Your Feedback (required, min 5 characters).",
          "Optional attachment.",
        ],
      },
    ],
  ),
  a(
    "help-center-billing",
    "Billing Ticket — In-Depth Guide",
    "Resolve subscription charges, refunds, plan mismatches, and Stripe issues.",
    [
      {
        id: "fields",
        title: "What to include",
        bullets: [
          "Issue Summary and Details (min 10 characters).",
          "Charge dates, amounts, plan names, or Stripe receipt details.",
          "Optional invoice screenshot — last four digits of card only, never full numbers.",
        ],
      },
      {
        id: "self-service",
        title: "Self-service first",
        bullets: [
          "Try Account → Billing or Manage subscription on /pricing before opening a ticket.",
          "Stripe Customer Portal updates payment method and downloads invoices.",
        ],
      },
    ],
  ),
  a(
    "help-center-account",
    "Account Ticket — In-Depth Guide",
    "Sign-in, profile, access, and account settings problems.",
    [
      {
        id: "use-cases",
        title: "Common use cases",
        bullets: [
          "Locked-out accounts or wrong email on file.",
          "Missing access after team or affiliate invite.",
          "Profile display issues.",
        ],
      },
      {
        id: "deletion",
        title: "Account deletion",
        paragraphs: [
          "Do not request deletion through this form. Use Clerk Security → Delete account, which Flipvise intercepts with a confirmation dialog.",
        ],
      },
    ],
  ),
  a(
    "help-center-my-tickets",
    "My Tickets — In-Depth Guide",
    "Track submitted tickets, read replies, and continue conversations.",
    [
      {
        id: "list",
        title: "Ticket list",
        bullets: [
          "Each row shows subject, preview, and status: Open, In progress, Resolved, or Closed.",
          "Tap a ticket to open the full thread dialog.",
        ],
      },
      {
        id: "thread",
        title: "Thread actions",
        bullets: [
          "View original message and attachments at the top.",
          "Reply while the ticket is open.",
          "Mark issue as resolved when satisfied.",
          "Reopen if the problem returns after resolution.",
          "Closed tickets cannot receive new replies.",
        ],
      },
    ],
  ),
  a(
    "help-center-priority-support",
    "Priority Support — In-Depth Guide",
    "Fast-track email support for Pro Plus and team-tier subscribers.",
    [
      {
        id: "eligibility",
        title: "Who qualifies",
        bullets: [
          "Pro Plus personal subscription.",
          "Active team-tier plan (Team Basic, Gold, Platinum, Enterprise).",
          "Platform administrators.",
          "Standard Pro does not see this tab.",
        ],
      },
      {
        id: "how-it-works",
        title: "How it works",
        bullets: [
          "First row on Help Center landing when eligible.",
          "Send Email opens your mail client with a pre-filled Priority Support subject.",
          "Target response: within 4 business hours (Mon–Fri, 9am–5pm EST).",
          "Use My tickets to track formal in-app requests in parallel.",
        ],
      },
    ],
  ),
];
