import type { DocSection } from "@/lib/documentation-content-types";

export type { DocPage, DocSection } from "@/lib/documentation-content-types";

export const ADMIN_DOCUMENTATION_SECTIONS: DocSection[] = [
  {
    id: "admin-overview",
    title: "Dashboard Overview",
    description: "Platform admin shell, metrics, and navigation.",
    pages: [
      {
        id: "admin-dashboard-overview",
        title: "Admin Dashboard Overview",
        route: "/admin",
        purpose:
          "Central platform administration hub for monitoring users, billing, support, plans, and affiliates.",
        howItWorks: [
          "Overview metrics show total users, decks, cards, admin-granted Pro Plus, and paid subscriber counts.",
          "Left Admin Menu switches between sections without leaving the dashboard.",
          "Personal Dashboard link returns to your own Flipvise workspace.",
          "Support notifications bell surfaces unread ticket and contact alerts.",
        ],
        requirements: [
          "Clerk publicMetadata role admin or superadmin, or PLATFORM_SUPERADMIN_USER_IDS allow-list.",
        ],
        doNots: [
          "Do not share admin URLs — access is enforced server-side on every /admin route.",
          "Co-admins cannot grant or revoke other co-admins — only the platform owner (superadmin).",
        ],
      },
    ],
  },
  {
    id: "users-billing",
    title: "Users & Billing",
    description: "User roster, subscriptions, invoices, and paid subscriber reporting.",
    pages: [
      {
        id: "all-users",
        title: "All Users",
        route: "/admin/all-users",
        purpose: "Search, filter, and manage every registered Clerk user.",
        howItWorks: [
          "Search by name or email; filter by plan, role (admin/user), and online/offline/banned status.",
          "Double-click a row to open the profile dialog with plan and billing details.",
          "Assign User Plan grants complimentary or admin-assigned tiers (invite-before-commit for changes).",
          "Ban User blocks sign-in; banned users show a destructive badge.",
        ],
        requirements: ["Platform admin access."],
        doNots: [
          "Do not ban the platform owner/superadmin.",
          "Do not assign plans to yourself without understanding billing side-effects.",
        ],
      },
      {
        id: "subscription",
        title: "Subscription",
        route: "/admin/subscription",
        purpose: "View Stripe-backed subscription rows derived from Clerk billing metadata and DB snapshots.",
        howItWorks: [
          "Lists plan slug, status, period dates, and user identity.",
          "Filter by paid-only, subscription status (active, trialing, past_due, canceled, inactive).",
          "Export CSV for offline analysis.",
        ],
        requirements: ["Platform admin access.", "Stripe webhooks syncing billing metadata."],
        doNots: [
          "Do not treat missing rows as proof of non-payment — verify Invoices tab and Stripe dashboard.",
        ],
      },
      {
        id: "invoices",
        title: "Invoices",
        route: "/admin/invoices",
        purpose: "Review persisted Stripe invoice history with promo attribution.",
        howItWorks: [
          "Filter by invoice status, date range, and search (invoice #, name, email).",
          "Promo column shows general vs affiliate codes and discount detail.",
          "Open hosted invoice or PDF links when Stripe provides them.",
          "Export CSV.",
        ],
        requirements: ["Platform admin access."],
        doNots: [
          "Do not edit invoice records here — billing changes happen in Stripe or via user checkout.",
        ],
      },
      {
        id: "paid-subscribers",
        title: "Paid Subscribers Report",
        route: "/admin/paid-subscribers",
        purpose: "Monthly breakdown of paying customers with revenue and promo analytics.",
        howItWorks: [
          "Grouped by calendar month for the selected year.",
          "Summary chips: Plan type Paid count, active subs, canceling, revenue YTD.",
          "Filter by year, month, plan, search, and sort.",
          "Billing period and latest invoice price per subscriber.",
        ],
        requirements: ["Platform admin access."],
        doNots: [
          "Paid plan access count may differ from invoice-history count — read the footnote on the page.",
        ],
      },
    ],
  },
  {
    id: "workspaces",
    title: "Team Workspaces",
    description: "Team-tier subscriber workspaces and membership totals.",
    pages: [
      {
        id: "team-workspaces",
        title: "Team Workspaces",
        route: "/admin/team-workspaces",
        purpose: "Inspect team-tier owners, workspace counts, invitee totals, and per-workspace details.",
        howItWorks: [
          "Lists users on team-tier plans with expandable workspace detail rows.",
          "Shows workspace names, member counts, and plan slug per owned team.",
          "Search and role/status filters match All Users patterns.",
          "Quiz question formats (multiple choice, true/false, fill-in-the-blank) are configured by subscribers in Team Admin → Deck Manager → Study privileges — not from this platform admin view.",
          "Subscribers can reshuffle which format each card uses after saving formats and generating AI content where required.",
        ],
        requirements: ["Platform admin access."],
        doNots: [
          "Do not delete workspaces from this view — subscribers manage workspaces in their dashboard.",
        ],
      },
    ],
  },
  {
    id: "platform-access",
    title: "Platform Access",
    description: "Co-admin roles and privilege audit trail.",
    pages: [
      {
        id: "admin-roles",
        title: "Admin Roles",
        route: "/admin/admin-roles",
        purpose: "Grant or revoke platform co-admin (admin) roles.",
        howItWorks: [
          "Roles sub-tab lists every user with current role badge.",
          "Toggle Admin Role — only superadmin/owner can promote or demote co-admins.",
          "Granting admin applies complimentary Pro Plus–level personal workspace features via metadata snapshot.",
        ],
        requirements: ["Superadmin (platform owner) for role changes."],
        doNots: [
          "Co-admins cannot change roles — read-only for them on this tab.",
          "Do not revoke your own superadmin access via Clerk Dashboard without a backup owner.",
        ],
      },
      {
        id: "audit-log",
        title: "Audit Log",
        route: "/admin/audit-log",
        purpose: "Read-only log of admin privilege grants and revocations.",
        howItWorks: [
          "Each row: target user, actor, action (granted/revoked), timestamp.",
          "Paired with Admin Roles tab under the same section.",
        ],
        requirements: ["Platform admin access."],
        doNots: ["Audit entries cannot be edited or deleted from the UI."],
      },
    ],
  },
  {
    id: "support",
    title: "Support Center",
    description: "In-app tickets and public Contact Us conversations.",
    pages: [
      {
        id: "support-tickets",
        title: "Support Tickets",
        route: "/admin/support-center",
        purpose: "Triage Help Center tickets submitted by signed-in users.",
        howItWorks: [
          "Filter by category, status, priority; search subject and user.",
          "Open thread to reply, change status, and view attachments.",
          "Stats summarize open, urgent, and resolved counts.",
        ],
        requirements: ["Platform admin access."],
        doNots: [
          "Do not share ticket screenshots containing secrets — redact before external forwarding.",
        ],
      },
      {
        id: "support-contact-us",
        title: "Contact Us",
        route: "/admin/support-center/contact-us",
        purpose: "Manage public Contact Us live chat threads and platform contact settings.",
        howItWorks: [
          "Reply to guest and signed-in Contact Us messages.",
          "Archive or mark threads read; stats show open and weekly volume.",
          "Edit support email, phone, and social links shown on /contact.",
        ],
        requirements: ["Platform admin access."],
        doNots: [
          "Guest threads rely on URL tokens — do not post tokens in public channels.",
        ],
      },
    ],
  },
  {
    id: "plans-affiliates",
    title: "Plans & Affiliates",
    description: "Pricing configuration, plan assignment history, and marketing affiliates.",
    pages: [
      {
        id: "pricing-plans",
        title: "Pricing Plans",
        route: "/admin/plans",
        purpose: "Edit plans-config.json tiers, prices, features, and promotion windows.",
        howItWorks: [
          "Edit plan display, Stripe price env references, discount coupons, and promo schedules.",
          "Changes affect /pricing cards and checkout validation.",
          "Affiliate discount blocks are configured per tier for combined codes.",
        ],
        requirements: ["Platform admin access.", "Matching Stripe price IDs in environment."],
        doNots: [
          "Do not hardcode price_* IDs in the editor — use env var keys as documented.",
          "Do not enable overlapping promo windows without verifying Stripe coupon validity.",
        ],
      },
      {
        id: "plan-history",
        title: "Plan Assignment History",
        route: "/admin/plan-history",
        purpose: "Audit log of admin-initiated plan grants, changes, and revocations.",
        howItWorks: [
          "Lists target user, action, plan names, assigning admin, and timestamp.",
          "Complements per-user Assign User Plan workflow with invite acceptance.",
        ],
        requirements: ["Platform admin access."],
        doNots: ["History is read-only — cannot undo from this table alone."],
      },
      {
        id: "affiliate-messaging",
        title: "Affiliate Messaging",
        route: "/admin/affiliate-messaging",
        purpose: "Broadcast promo announcements to active affiliates via dashboard inbox.",
        howItWorks: [
          "Compose broadcast subject and body for affiliate inbox delivery.",
          "No Loops email — recipients must resolve to a Clerk user.",
          "Use for campaign announcements alongside pricing promo windows.",
        ],
        requirements: ["Platform admin access.", "Active affiliates with Clerk accounts or invite emails."],
        doNots: [
          "Do not use broadcasts for individual invite links — use Marketing Affiliates invite flow.",
        ],
      },
      {
        id: "marketing-affiliates",
        title: "Marketing Affiliates",
        route: "/admin/marketing-affiliates",
        purpose: "Invite, edit, revoke, and quota-manage marketing affiliate arrangements.",
        howItWorks: [
          "Invite affiliate by email with plan grant, end date, and accept-link expiry.",
          "Edit pending invites or active arrangements (arrangement changes require affiliate confirmation).",
          "Referral quota toggles auto-renewal targets for complimentary plan periods.",
          "Copy invite link for manual delivery when Loops email is skipped.",
        ],
        requirements: ["Platform admin access."],
        doNots: [
          "Do not change active plan/end without expecting inbox confirmation from the affiliate.",
          "Do not forward single-use accept tokens.",
        ],
      },
      {
        id: "plan-trials",
        title: "Plan Trials",
        route: "/admin/plan-trials",
        purpose: "Configure free-trial length and pricing-page visibility per paid tier.",
        howItWorks: [
          "Set trial days (0–90) and Published on pricing toggle for each paid plan.",
          "Published trials appear as Start free trial on /pricing (monthly checkout only).",
          "Each user may start a published trial only once — tracked in user_plan_trials.",
          "Trial checkouts use noPromoCheckoutDiscount — no coupons, affiliate codes, or allow_promotion_codes.",
          "Trial ending and expired notices appear in the user's dashboard inbox.",
        ],
        requirements: ["Platform admin access.", "Matching Stripe price IDs for trial-eligible plans."],
        doNots: [
          "Do not publish trials with 0 days — the toggle is disabled until days > 0.",
          "Do not expect yearly checkout to offer trials — monthly only.",
        ],
      },
    ],
  },
  {
    id: "platform-documentation",
    title: "Platform Documentation",
    description: "Edit, search, and AI-update user and admin product guides.",
    pages: [
      {
        id: "documentation-manager",
        title: "Documentation Manager",
        route: "/admin/documentation",
        purpose:
          "Maintain user (/docs) and admin guides with manual edits, search, and the documentation AI agent.",
        howItWorks: [
          "Switch between Admin documentation and User documentation tabs.",
          "Edit mode toggles inline edit buttons on quick reference and in-depth guides.",
          "Manual edits save to documentation_overrides in the database — visible immediately at /docs and /admin/documentation.",
          "Documentation AI agent proposes add/update/remove operations from natural-language instructions and UI screenshots.",
          "Enable Auto-apply changes to save agent operations without a separate confirmation step.",
          "Cross-guide search finds topics across quick reference and in-depth articles.",
        ],
        requirements: ["Platform admin access."],
        doNots: [
          "DB overrides do not update src/data source files or documentation-sync-baseline.json — developers must sync source files for CI stale-doc checks.",
          "Do not invent features in docs that are not implemented in code.",
        ],
      },
    ],
  },
];
