import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

export const ACCOUNT_CLERK_ARTICLES: DocArticle[] = [
  a(
    "clerk-profile",
    "Clerk Profile & Security — In-Depth Guide",
    "Manage identity and security through the account avatar → Manage account.",
    [
      {
        id: "profile",
        title: "Profile tab",
        bullets: [
          "Update display name and profile image.",
          "Add, verify, or set primary email address.",
          "Account details (custom tab) also stores mailing address with a State / province / parish field; the current-details summary omits Parish from parish names.",
        ],
      },
      {
        id: "security",
        title: "Security tab",
        bullets: [
          "Change password.",
          "Enable two-factor authentication (2FA).",
          "Review and revoke active sessions.",
        ],
      },
      {
        id: "cautions",
        title: "Important cautions",
        bullets: [
          "Do not remove primary email if team or affiliate invites are tied to it.",
          "Account deletion from Clerk Security is intercepted by Flipvise — read the confirmation dialog first.",
          "Dashboard links from Manage account do not put your Clerk user id in the address bar.",
        ],
      },
    ],
  ),
  a(
    "account-details-settings",
    "Account Details — In-Depth Guide",
    "Custom Clerk tab (first item in Manage account) for phone, mailing address, type/status, and security questions.",
    [
      {
        id: "fields",
        title: "Displayed and editable fields",
        bullets: [
          "Current details summary shows phone number, mailing address (Jamaica parish names without the word Parish), type/status, and Security Q&A as **************.",
          "Click the masked Security Q&A to re-verify your login; after success, all questions and answers are displayed.",
          "Click Edit details — you must re-verify your login (Clerk step-up) before the form unlocks; Cancel discards unsaved changes.",
          "Mailing address: street address, country from the full country list, state / province / parish filtered by country (Jamaica options omit the word Parish), city, and optional postal code.",
          "Type / status: Student, Teacher, Parent, Education Institution, Corporation.",
          "Name of institution or corporation appears when those types are selected.",
          "Three security questions: pick three different prompts and enter answers only you would know.",
        ],
      },
      {
        id: "save",
        title: "Saving",
        paragraphs: [
          "Save changes runs a Server Action that updates your Flipvise profile, then returns you to the read-only summary. Phone, mailing address, and type/status are stored for support; security answers are stored privately. Incomplete profiles are redirected to Account details before the personal dashboard (/dashboard, no Clerk user id in the URL) unlocks.",
        ],
      },
    ],
  ),
  a(
    "appearance-settings",
    "Appearance Settings — In-Depth Guide",
    "Custom Clerk tab for theme, interface colors, and microphone settings.",
    [
      {
        id: "theme",
        title: "Theme and colors",
        bullets: [
          "Light or dark base theme.",
          "Free users: 3 interface color presets.",
          "Pro: 8 interface background accent colors.",
          "Pro Plus, team tier, or admin grant: full 12-color palette.",
          "Illustrated Deck Design is included on every plan, including Free. It appears after a platform admin enables it. Your on/off choice is saved either way. A sign-in prompt points to Manage account, then Appearance, when the switch is off.",
          "Reduce animations limits movement. The device reduced-motion setting is also respected.",
          "Change background artwork sets how often the scene changes, from 2 hours to 24 hours. Off keeps the current scene.",
          "Account menu links back to Personal Dash at /dashboard without a Clerk user id in the address bar.",
        ],
      },
      {
        id: "microphone",
        title: "Microphone settings",
        paragraphs: [
          "Configure speech-to-text input for deck creation when your plan supports it.",
        ],
      },
    ],
  ),
  a(
    "billing-tab",
    "Billing Tab — In-Depth Guide",
    "In-app view of plan status, Stripe portal access, and plan history.",
    [
      {
        id: "features",
        title: "Tab features",
        bullets: [
          "Effective plan label and access subtitle. The plan name in the signed-in header opens this tab.",
          "Manage billing → Stripe Customer Portal (card, address, invoices).",
          "Cancel subscription: with active Stripe add-ons, choose add-on(s) only (default), plan (add-ons stop with the plan), or both. Access continues until period end.",
          "Add-on-only cancel keeps the base plan renewing and writes an Inbox notice. If plan renewal was canceled, use Keep renewing plan to resume.",
          "Plan history lists plan invoices, plan-change (proration) receipts, and add-on receipts as separate rows (Canceling when renewal is ending). Receipts show plan start, plan end, and auto-renewal On or Off.",
          "Checkout success returns to /dashboard?checkout=success without Stripe session ids in the address bar.",
        ],
      },
      {
        id: "complimentary",
        title: "Complimentary access",
        paragraphs: [
          "Admin-granted or affiliate complimentary plans hide paid Stripe controls — contact support for billing questions.",
        ],
      },
      {
        id: "zero-dollar-invoices",
        title: "Plan changes paid from credit",
        paragraphs: [
          "Downgrades and some add-on first invoices can settle at $0 using Stripe customer credit/balance. Those appear as paid invoices (and in Plan history receipts), not as new card charges under Stripe Payments.",
        ],
      },
      {
        id: "renewal-cancel",
        title: "Ending renewal (no new charge)",
        paragraphs: [
          "Scheduling cancel at period end does not create a Stripe Payment or receipt. Stripe marks the subscription to stop renewing; Flipvise confirms in Inbox and Plan history.",
        ],
      },
    ],
  ),
  a(
    "account-delete",
    "Delete Account — In-Depth Guide",
    "Permanent removal of your Flipvise account and associated data.",
    [
      {
        id: "flow",
        title: "Deletion flow",
        bullets: [
          "Clerk Security → Delete account triggers Flipvise interception.",
          "Confirmation dialog explains consequences and any prorated refund, and stays readable in light and dark mode.",
          "Type DELETE, then re-enter your sign-in credentials — irreversible.",
        ],
      },
      {
        id: "before-delete",
        title: "Before you delete",
        bullets: [
          "Export or save important decks.",
          "If you are sole owner of active team workspaces, transfer or resolve ownership first.",
        ],
      },
    ],
  ),
  a(
    "account-deletion-request",
    "Account deletion request — In-Depth Guide",
    "The public page at /account-deletion explains how to request deletion of a Flipvise account and what happens to the data.",
    [
      {
        id: "steps",
        title: "Steps to request deletion",
        bullets: [
          "Open https://learn.flipvisestudio.com/account-deletion. The Android app does not need to be installed.",
          "If you can sign in: open learn.flipvisestudio.com or the Flipvise app, sign in with the account you want deleted, then open the account menu → Manage account → Delete account.",
          "Type DELETE and confirm with your sign-in. Deletion is permanent and finishes when you confirm.",
          "If you cannot sign in: send the request from Contact Us and include the email address on the Flipvise account. Flipvise Studio LLC deletes that account and its data after the email is matched.",
        ],
      },
      {
        id: "deleted",
        title: "Data deleted",
        paragraphs: [
          "There is no additional retention period. Signed-in deletion finishes when you confirm DELETE. A Contact Us request finishes when the email is matched and the deletion is completed. Flipvise does not keep this data after that.",
        ],
        bullets: [
          "Account name, email address, and sign-in.",
          "Phone number, mailing address, account type, and security answers.",
          "Decks, cards, images, quiz results, lesson plans, homework, essays, and class records stored for that account.",
          "Inbox messages, support messages, push tokens, and AI usage records for that account.",
        ],
      },
      {
        id: "kept",
        title: "Data kept",
        bullets: [
          "A copy of decks stored only on your phone for offline study stays on that device until you remove the Flipvise app or its storage. Flipvise does not keep a server copy of that account after deletion.",
          "Study content owned by another account, such as a class workspace you joined, stays with that owner.",
          "Stripe keeps the payment record for a prorated refund and for Stripe’s own legal records. Flipvise does not store the card number and does not keep a separate copy after the account is deleted.",
        ],
      },
      {
        id: "contact",
        title: "Contact",
        bullets: [
          "Questions about deleting a Flipvise account can be sent from Contact Us.",
          "The Privacy Policy describes the rest of the data Flipvise collects.",
        ],
      },
    ],
  ),
];
