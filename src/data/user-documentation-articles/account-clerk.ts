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
          "Connected accounts for social sign-in providers.",
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
          "Current details summary shows phone number, mailing address, type/status, organization (if any), and security Q&A (read-only until you edit).",
          "Click Edit details to change phone, mailing address, type/status, and security questions; Cancel discards unsaved changes.",
          "Mailing address: street address, country from the full country list, state/province filtered by country, city, and optional postal code.",
          "Type / status: Student, Teacher, Parent, Education Institution, Corporation.",
          "Name of institution or corporation appears when those types are selected.",
          "Three security questions: pick three different prompts and enter answers only you would know.",
        ],
      },
      {
        id: "save",
        title: "Saving",
        paragraphs: [
          "Save changes runs a Server Action that updates your Flipvise profile, then returns you to the read-only summary. Phone, mailing address, and type/status are stored for support; security answers are stored privately. Incomplete profiles are redirected to Account details before the personal dashboard unlocks.",
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
          "Effective plan label and access subtitle.",
          "Manage billing → Stripe Customer Portal (card, address, invoices).",
          "Cancel subscription with prorated refund preview when eligible.",
          "Plan history table of past plan changes.",
        ],
      },
      {
        id: "complimentary",
        title: "Complimentary access",
        paragraphs: [
          "Admin-granted or affiliate complimentary plans hide paid Stripe controls — contact support for billing questions.",
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
          "Confirmation dialog explains consequences and any prorated refund.",
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
];
