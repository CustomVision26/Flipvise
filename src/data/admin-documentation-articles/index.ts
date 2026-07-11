import type { DocArticle } from "@/lib/user-documentation-article-types";

function a(
  pageId: string,
  title: string,
  intro: string,
  sections: DocArticle["sections"],
): DocArticle {
  return { pageId, title, intro, sections };
}

const ALL_ARTICLES: DocArticle[] = [
  a(
    "admin-dashboard-overview",
    "Admin Dashboard Overview — In-Depth Guide",
    "The platform admin hub at /admin surfaces live metrics, billing snapshots, and navigation to every admin section.",
    [
      {
        id: "access",
        title: "Who can access",
        table: {
          headers: ["Role", "Access level"],
          rows: [
            ["superadmin", "Full access; can grant or revoke co-admins"],
            ["admin (co-admin)", "Full dashboard except Admin Roles changes"],
            ["PLATFORM_SUPERADMIN_USER_IDS", "Auto-reconciled to superadmin on sign-in"],
            ["Regular user", "Redirected — every /admin route is server-guarded"],
          ],
        },
        paragraphs: [
          "Access is enforced on every admin route via Clerk publicMetadata.role and the superadmin allow-list. Do not share admin URLs — unauthenticated or unauthorized users cannot reach these pages.",
        ],
      },
      {
        id: "metrics",
        title: "Overview metrics",
        bullets: [
          "Total Users — registered Clerk accounts.",
          "Total Decks and Total Cards — aggregate flashcard content across the platform.",
          "Paid Subscribers card — compares paid plan access count (Clerk metadata) with DB invoice/subscription snapshots; links to Subscription and Invoices tabs.",
          "Admin-granted Pro Plus — co-admins, superadmins, and other complimentary admin grants with Pro Plus–level personal workspace features.",
        ],
      },
      {
        id: "navigation",
        title: "Shell and navigation",
        bullets: [
          "Left Admin Menu switches sections (Users & Billing, Team Workspaces, Platform Access, Support Center, Plans & Affiliates) without leaving the dashboard.",
          "Personal Dashboard link returns to your own Flipvise workspace.",
          "Support notifications bell surfaces unread Help Center tickets and Contact Us thread alerts.",
          "Section routes map to dedicated URLs (e.g. /admin/all-users, /admin/plans) for deep linking.",
        ],
      },
      {
        id: "cautions",
        title: "Operational cautions",
        bullets: [
          "Co-admins cannot grant or revoke other co-admins — only the platform owner (superadmin) can change Admin Roles.",
          "Overview billing counts may differ slightly from Stripe Dashboard — cross-check Invoices and Paid Subscribers when reconciling revenue.",
        ],
      },
    ],
  ),
  a(
    "all-users",
    "All Users — In-Depth Guide",
    "Search, inspect, and manage every registered Clerk user at /admin/all-users.",
    [
      {
        id: "table",
        title: "User roster",
        bullets: [
          "Search by display name or email address.",
          "Filter by plan type (Free, Pro, Pro Plus, education tiers, team tiers, Paid, Admin-granted, etc.).",
          "Filter by role: admin, superadmin, or regular user.",
          "Filter by status: online, offline, or banned.",
          "Double-click a row to open the profile dialog with plan, billing, and metadata details.",
        ],
      },
      {
        id: "assign-plan",
        title: "Assign User Plan",
        paragraphs: [
          "Admin plan assignment uses an invite-before-commit flow for most changes. The target user receives an inbox invite and must accept before Clerk metadata and Stripe billing update. Complimentary grants skip Stripe; paid upgrades on active subscriptions trigger Stripe proration on accept.",
        ],
        bullets: [
          "Pending invites appear in the user's dashboard inbox — plan is not applied until accepted.",
          "Direct override (support tool) exists for immediate metadata writes without user consent — use only for testing or emergency support, not for initiating real billing.",
          "Plan Assignment History tab logs every admin-initiated grant, change, or revocation.",
        ],
      },
      {
        id: "ban",
        title: "Ban User",
        bullets: [
          "Ban User blocks Clerk sign-in for the account.",
          "Banned users show a destructive badge in the roster.",
          "Do not ban the platform owner/superadmin.",
          "Unban restores normal sign-in access.",
        ],
      },
      {
        id: "cautions",
        title: "Do not",
        bullets: [
          "Do not assign plans to yourself without understanding billing side-effects.",
          "Do not treat the Plan column alone as proof of Stripe payment — verify Subscription and Invoices tabs.",
        ],
      },
    ],
  ),
  a(
    "subscription",
    "Subscription — In-Depth Guide",
    "Review Stripe-backed subscription rows at /admin/subscription derived from Clerk billing metadata and persisted DB snapshots.",
    [
      {
        id: "columns",
        title: "What each row shows",
        bullets: [
          "Plan slug (pro, pro_plus, team tiers, etc.) and subscription status.",
          "Billing period start/end dates when available from Stripe sync.",
          "User identity — name and email from Clerk.",
          "Status values include active, trialing, past_due, canceled, and inactive.",
        ],
      },
      {
        id: "filters",
        title: "Filters and export",
        bullets: [
          "Paid-only toggle hides free and complimentary rows.",
          "Status filter narrows to a single subscription state.",
          "Search by user name or email.",
          "Export CSV for offline analysis or accounting handoff.",
        ],
      },
      {
        id: "sync",
        title: "How data stays current",
        paragraphs: [
          "Stripe webhooks (checkout.session.completed, customer.subscription.updated/deleted, invoice events) update Clerk publicMetadata billing fields and the stripe_subscriptions DB table. Missing rows usually mean the webhook has not synced yet or the user holds complimentary access without a Stripe subscription.",
        ],
      },
      {
        id: "cautions",
        title: "Reconciliation tips",
        bullets: [
          "Do not treat missing rows as proof of non-payment — verify the Invoices tab and Stripe Dashboard.",
          "Affiliate complimentary plans and admin grants may show Paid plan access without a Stripe subscription row.",
        ],
      },
    ],
  ),
  a(
    "invoices",
    "Invoices — In-Depth Guide",
    "Review persisted Stripe invoice history with promo attribution at /admin/invoices.",
    [
      {
        id: "table",
        title: "Invoice table",
        bullets: [
          "Invoice number, amount, currency, and status (paid, open, void, uncollectible, etc.).",
          "Customer name and email from Stripe.",
          "Plan and billing period associated with the charge.",
          "Promo column — general public codes vs affiliate codes with discount detail.",
        ],
      },
      {
        id: "filters",
        title: "Search and filters",
        bullets: [
          "Filter by invoice status.",
          "Date range picker for period-bound reporting.",
          "Search by invoice number, customer name, or email.",
          "Export CSV for finance or tax records.",
        ],
      },
      {
        id: "links",
        title: "Hosted invoice and PDF",
        bullets: [
          "Open hosted invoice link when Stripe provides a hosted_invoice_url.",
          "Download PDF when invoice_pdf is available on the Stripe object.",
          "Proration receipts from plan changes appear here after invoice.payment_succeeded webhook processing.",
        ],
      },
      {
        id: "cautions",
        title: "Read-only billing",
        paragraphs: [
          "This view is read-only. Billing corrections happen in the Stripe Dashboard or through user checkout — not by editing rows here.",
        ],
      },
    ],
  ),
  a(
    "paid-subscribers",
    "Paid Subscribers Report — In-Depth Guide",
    "Monthly breakdown of paying customers with revenue and promo analytics at /admin/paid-subscribers.",
    [
      {
        id: "layout",
        title: "Report layout",
        bullets: [
          "Grouped by calendar month for the selected year.",
          "Summary chips: plan-type paid count, active subscriptions, canceling subs, and revenue YTD.",
          "Each subscriber row shows billing period and latest invoice price.",
          "Filter by year, month, plan slug, free-text search, and sort order.",
        ],
      },
      {
        id: "counts",
        title: "Understanding the counts",
        table: {
          headers: ["Metric", "Source"],
          rows: [
            ["Paid plan access (All Users)", "Clerk metadata — includes active affiliates and some grants"],
            ["DB paid subscriber count", "Persisted billing invoices / subscription snapshots"],
            ["This report", "Invoice-history–driven monthly grouping"],
          ],
        },
        paragraphs: [
          "Paid plan access count may differ from invoice-history count — read the footnote on the page. Affiliates with complimentary access and admin grants can inflate the Clerk-side count without a matching invoice row.",
        ],
      },
      {
        id: "use-cases",
        title: "When to use this report",
        bullets: [
          "Monthly revenue rollups and year-over-year comparisons.",
          "Identifying cancel-at-period-end subscribers before churn.",
          "Promo code effectiveness by month when paired with Invoices promo column.",
        ],
      },
    ],
  ),
  a(
    "team-workspaces",
    "Team Workspaces — In-Depth Guide",
    "Inspect team-tier subscribers, workspace counts, and membership totals at /admin/team-workspaces.",
    [
      {
        id: "roster",
        title: "Team-tier roster",
        bullets: [
          "Lists users on team-tier plans (Team Basic, Team Gold, Platinum, Enterprise).",
          "Expandable rows show each owned workspace name, member count, and plan slug.",
          "Invitee totals summarize pending and accepted team invitations per owner.",
          "Search and role/status filters follow the same patterns as All Users.",
        ],
      },
      {
        id: "plans",
        title: "Team plan limits",
        table: {
          headers: ["Plan slug", "Max workspaces", "Max members/workspace"],
          rows: [
            ["pro_plus_team_basic (Team Basic)", "2", "5"],
            ["pro_plus_team_gold (Team Gold)", "5", "15"],
            ["pro_plus_platinum_plan (Platinum)", "10", "25"],
            ["pro_plus_enterprise (Enterprise)", "30", "40"],
          ],
        },
        paragraphs: [
          "Legacy metadata may still use pro_team_basic, pro_team_gold, etc. — the app normalizes these via canonicalTeamPlanId(). Team subscribers get Pro-level features on their personal dashboard while the team workspace reflects the full purchased tier.",
        ],
      },
      {
        id: "access",
        title: "Membership model",
        bullets: [
          "Subscribing to a team plan makes the subscriber a team admin (teamRole: team_admin).",
          "All other members join by invitation only — there is no self-join.",
          "Platform admins can be invited into team workspaces; memberships sync to teamTierInvitedMemberships metadata.",
        ],
      },
      {
        id: "subscriber-features",
        title: "Subscriber-managed quiz settings",
        bullets: [
          "Team owners and co-admins configure quiz question formats per workspace or deck in Team Admin → Deck Manager → Study privileges.",
          "Formats: multiple choice (from card content), true/false, and fill-in-the-blank (AI-generated sentences).",
          "After setup, admins can Reshuffle format questions to change which format each card uses in team quizzes.",
          "Platform admins troubleshooting missing formats should verify settings are saved, AI generation completed, and reshuffle was run when multiple formats are enabled.",
        ],
      },
      {
        id: "cautions",
        title: "Do not",
        bullets: [
          "Do not delete workspaces from this view — subscribers manage workspaces in their Team Admin Dashboard.",
          "Do not confuse personal-dashboard Pro features with the team workspace tier — they resolve separately.",
        ],
      },
    ],
  ),
  a(
    "admin-roles",
    "Admin Roles — In-Depth Guide",
    "Grant or revoke platform co-admin roles at /admin/admin-roles.",
    [
      {
        id: "hierarchy",
        title: "Role hierarchy",
        table: {
          headers: ["publicMetadata.role", "Set by", "Powers"],
          rows: [
            ["superadmin", "PLATFORM_SUPERADMIN_USER_IDS env + reconciliation", "Full access; promote/demote co-admins"],
            ["admin", "Superadmin via Admin Roles tab", "Co-admin dashboard access"],
            ["(absent)", "—", "Regular user"],
          ],
        },
      },
      {
        id: "grant",
        title: "Granting co-admin",
        bullets: [
          "Roles sub-tab lists every user with their current role badge.",
          "Toggle Admin Role — only superadmin/owner can promote or demote co-admins.",
          "Granting admin applies complimentary Pro Plus–level personal workspace features via adminGranted metadata.",
          "preAdminGrantSnapshot is saved at grant time so the pre-admin state restores on revoke.",
        ],
      },
      {
        id: "revoke",
        title: "Revoking co-admin",
        bullets: [
          "Revoke restores adminGranted and related fields from preAdminGrantSnapshot.",
          "teamTierInvitedMemberships is cleared on revoke.",
          "Co-admins see this tab read-only — they cannot change anyone's role.",
        ],
      },
      {
        id: "cautions",
        title: "Safety",
        bullets: [
          "Do not revoke your own superadmin access via Clerk Dashboard without a backup owner.",
          "Never write role, adminGranted, or preAdminGrantSnapshot manually — use admin-role-metadata helpers server-side.",
        ],
      },
    ],
  ),
  a(
    "audit-log",
    "Audit Log — In-Depth Guide",
    "Read-only log of admin privilege grants and revocations at /admin/audit-log.",
    [
      {
        id: "entries",
        title: "What is logged",
        bullets: [
          "Target user — who received or lost admin privileges.",
          "Actor — which superadmin performed the action.",
          "Action — granted or revoked.",
          "Timestamp — when the change was recorded.",
        ],
      },
      {
        id: "pairing",
        title: "Relationship to Admin Roles",
        paragraphs: [
          "The Audit Log tab pairs with the Admin Roles tab under Platform Access. Every role toggle on Admin Roles writes a corresponding audit entry. Plan assignment history lives separately on the Plan Assignment History tab.",
        ],
      },
      {
        id: "immutable",
        title: "Immutable records",
        bullets: [
          "Audit entries cannot be edited or deleted from the UI.",
          "Use this trail for compliance reviews and co-admin onboarding/offboarding verification.",
        ],
      },
    ],
  ),
  a(
    "support-tickets",
    "Support Tickets — In-Depth Guide",
    "Triage Help Center tickets submitted by signed-in users at /admin/support-center.",
    [
      {
        id: "queue",
        title: "Ticket queue",
        bullets: [
          "Filter by category, status, and priority.",
          "Search subject line and submitting user.",
          "Stats summarize open, urgent, and resolved counts at the top of the panel.",
          "Open a thread to read the full conversation and attachments.",
        ],
      },
      {
        id: "actions",
        title: "Reply and status",
        bullets: [
          "Reply in-thread — responses reach the user's Help Center My tickets view.",
          "Change status (open, in progress, resolved, etc.) as triage progresses.",
          "View uploaded attachments inline when the user included files.",
        ],
      },
      {
        id: "priority",
        title: "Priority Support eligibility",
        table: {
          headers: ["Tier", "Priority Support tab"],
          rows: [
            ["Free / Pro", "No — standard Support categories only"],
            ["Pro Plus", "Yes"],
            ["Education Plus / Gold / Enterprise", "Yes"],
            ["Team tiers", "Yes"],
            ["Platform admin", "Yes (complimentary)"],
          ],
        },
        paragraphs: [
          "Priority Support tickets may arrive with higher urgency expectations (4 business hour target, Mon–Fri 9am–5pm EST). Standard Pro users use Support, Bug Report, and Billing categories without the Priority Support tab.",
        ],
      },
      {
        id: "cautions",
        title: "Security",
        bullets: [
          "Do not share ticket screenshots containing secrets — redact API keys, tokens, and passwords before external forwarding.",
        ],
      },
    ],
  ),
  a(
    "support-contact-us",
    "Contact Us — In-Depth Guide",
    "Manage public Contact Us live chat threads and platform contact settings at /admin/support-center/contact-us.",
    [
      {
        id: "threads",
        title: "Contact Us threads",
        bullets: [
          "Reply to guest and signed-in Contact Us messages from /contact.",
          "Archive or mark threads read to keep the inbox manageable.",
          "Stats show open threads and weekly message volume.",
          "Guest threads are tied to URL tokens — do not post tokens in public channels.",
        ],
      },
      {
        id: "settings",
        title: "Platform contact settings",
        bullets: [
          "Edit support email, phone number, and social links displayed on the public /contact page.",
          "Changes apply immediately to the Contact Us page footer and contact cards.",
          "Keep email addresses monitored — guest replies do not require a Clerk account.",
        ],
      },
      {
        id: "notifications",
        title: "Admin notifications",
        paragraphs: [
          "Unread Contact Us threads contribute to the support notifications bell on the admin shell alongside Help Center tickets.",
        ],
      },
    ],
  ),
  a(
    "pricing-plans",
    "Pricing Plans — In-Depth Guide",
    "Edit plans-config.json tiers, prices, features, and promotion windows at /admin/plans.",
    [
      {
        id: "editor",
        title: "Plans config editor",
        bullets: [
          "Edit display names, descriptions, feature bullet lists, and sort order for /pricing cards.",
          "Stripe price references use env var keys (STRIPE_PRO_PRICE_ID, STRIPE_PRO_PLUS_YEARLY_PRICE_ID, team-tier keys, etc.) — never hardcode price_* IDs in the editor.",
          "Affiliate discount blocks configure per-tier combined promo codes.",
          "Save writes plans-config.json — changes affect checkout validation and pricing page rendering.",
        ],
      },
      {
        id: "promos",
        title: "Promotion windows",
        bullets: [
          "Schedule promo start/end dates and attach Stripe coupon IDs from plans-config.json.",
          "When a coupon is active, checkout passes discounts: [{ coupon }] — when no coupon, allow_promotion_codes: true. Never set both simultaneously — Stripe rejects it.",
          "Do not enable overlapping promo windows without verifying Stripe coupon validity and expiration.",
        ],
      },
      {
        id: "slugs",
        title: "Plan slugs",
        table: {
          headers: ["Slug", "Display name"],
          rows: [
            ["pro", "Pro"],
            ["pro_plus", "Pro Plus"],
            ["education_plus", "Education Plus"],
            ["pro_plus_team_basic", "Team Basic"],
            ["pro_plus_team_gold", "Team Gold"],
            ["education_gold", "Education Gold"],
            ["pro_plus_platinum_plan", "Platinum"],
            ["pro_plus_enterprise", "Enterprise"],
            ["education_enterprise", "Education Enterprise"],
          ],
        },
      },
      {
        id: "env",
        title: "Environment requirements",
        bullets: [
          "Matching Stripe price IDs must be set in Render/production environment variables.",
          "Test keys (sk_test_*) and live keys (sk_live_*) must match across STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.",
        ],
      },
    ],
  ),
  a(
    "plan-history",
    "Plan Assignment History — In-Depth Guide",
    "Audit log of admin-initiated plan grants, changes, and revocations at /admin/plan-history.",
    [
      {
        id: "columns",
        title: "History columns",
        bullets: [
          "Target user — who received the plan action.",
          "Action — grant, change, revoke, or invite-related event.",
          "Plan names — previous and new tier when applicable.",
          "Assigning admin — which platform admin initiated the change.",
          "Timestamp — when the action was recorded.",
        ],
      },
      {
        id: "flow",
        title: "Invite-before-commit pairing",
        paragraphs: [
          "This log complements the Assign User Plan workflow on All Users. When an admin sends a plan invite, a pending record is created; the history entry reflects the admin action even before the user accepts. Acceptance updates Clerk metadata (and Stripe for paid upgrades on active subscriptions) and may generate a follow-on log entry.",
        ],
      },
      {
        id: "limits",
        title: "What history cannot do",
        bullets: [
          "History is read-only — you cannot undo a plan change from this table alone.",
          "To reverse a grant, use Assign User Plan again or the Marketing Affiliates revoke flow for affiliate arrangements.",
          "Stripe proration receipts for paid upgrades appear in Invoices after the user accepts and Stripe invoices.",
        ],
      },
    ],
  ),
  a(
    "affiliate-messaging",
    "Affiliate Messaging — In-Depth Guide",
    "Broadcast promo announcements to active affiliates via dashboard inbox at /admin/affiliate-messaging.",
    [
      {
        id: "compose",
        title: "Compose a broadcast",
        bullets: [
          "Enter subject and body for a platform-wide affiliate inbox message.",
          "Delivery targets active affiliates who resolve to a Clerk user (stored invitedUserId or invite email match).",
          "Messages land in affiliate_broadcast_inbox_messages — recipients read them in Dashboard → Inbox.",
        ],
      },
      {
        id: "no-loops",
        title: "Inbox only — no Loops email",
        paragraphs: [
          "Affiliate messaging broadcasts do not send Loops transactional email. This is intentional — use for campaign announcements alongside pricing promo windows. Individual invite links and arrangement confirmations use separate flows on Marketing Affiliates.",
        ],
      },
      {
        id: "when",
        title: "When to use broadcasts",
        bullets: [
          "Announce a new combined affiliate promo code during a plans-config sale window.",
          "Share campaign deadlines or creative asset updates.",
          "Do not use broadcasts for individual invite links — use Marketing Affiliates invite flow instead.",
          "Do not use broadcasts to deliver single-use accept tokens.",
        ],
      },
    ],
  ),
  a(
    "marketing-affiliates",
    "Marketing Affiliates — In-Depth Guide",
    "Invite, edit, revoke, and quota-manage marketing affiliate arrangements at /admin/marketing-affiliates.",
    [
      {
        id: "invite",
        title: "Invite affiliate",
        bullets: [
          "Invite by email with plan grant slug, arrangement end date, and accept-link expiry (days).",
          "Pending invite — no Clerk plan change until the affiliate accepts via inbox or accept URL.",
          "Loops transactional email sends only when the email has no matching Clerk account at invite time (LOOPS_API_KEY + LOOPS_AFFILIATE_INVITATION_TRANSACTIONAL_ID required).",
          "Registered invitees receive dashboard inbox notification only — use Copy invite link for manual delivery when Loops is skipped.",
        ],
      },
      {
        id: "edit",
        title: "Edit pending or active",
        bullets: [
          "Edit pending invites — saving plan/end/email/accept-days rotates the accept token; Loops re-sends only if invitee still has no Clerk account.",
          "Edit active arrangement (plan or end date) — writes pending fields; Clerk plan does not change until affiliate confirms via inbox (Confirm arrangement change) or /affiliate/confirm-arrangement?token=.",
          "Arrangement update reminders are inbox-only — LOOPS_AFFILIATE_ARRANGEMENT_UPDATE_TRANSACTIONAL_ID is not invoked by default.",
        ],
      },
      {
        id: "quota",
        title: "Referral quota",
        bullets: [
          "Referral quota toggles auto-renewal targets for complimentary plan periods when referral thresholds are met.",
          "Quota evaluation runs on admin dashboard load via evaluateAllActiveAffiliateQuotas.",
          "Revoke ends the arrangement and clears affiliate plan access after confirmation flows complete.",
        ],
      },
      {
        id: "cautions",
        title: "Security and consent",
        bullets: [
          "Do not change active plan/end without expecting inbox confirmation from the affiliate.",
          "Do not forward single-use accept tokens — they expire after configured days (AFFILIATE_INVITE_EXPIRY_DAYS / per-invite override).",
          "Accept links use NEXT_PUBLIC_APP_URL — ensure production origin is set correctly on Render.",
        ],
      },
    ],
  ),
  a(
    "plan-trials",
    "Plan Trials — In-Depth Guide",
    "Configure per-plan free trials and pricing-page visibility at /admin/plan-trials.",
    [
      {
        id: "settings",
        title: "Trial settings per plan",
        bullets: [
          "Trial days — 0 to 90; must be > 0 before Published on pricing can be enabled.",
          "Published on pricing — when on, eligible users see Start free trial on /pricing (monthly checkout only).",
          "Save per plan — writes trial config to plans-config.json.",
        ],
      },
      {
        id: "checkout",
        title: "Checkout behavior",
        bullets: [
          "One trial per account — user_plan_trials table tracks consumption.",
          "Trial checkout sets trial_period_days on Stripe subscription — $0 today, card on file for renewal.",
          "Trials use noPromoCheckoutDiscount — no general coupon, affiliate code, or allow_promotion_codes.",
          "Yearly billing period does not offer trials — monthly only.",
          "Trial ending and expired inbox notices remind users before and after trial ends.",
        ],
      },
      {
        id: "stripe-env",
        title: "Stripe environment",
        bullets: [
          "Education plans use STRIPE_EDUCATION_* price env vars (see stripe-plan-price-env.ts).",
          "Trial-eligible plans need valid monthly Stripe price IDs in environment.",
        ],
      },
    ],
  ),
  a(
    "documentation-manager",
    "Documentation Manager — In-Depth Guide",
    "Maintain user and admin product guides at /admin/documentation.",
    [
      {
        id: "tabs",
        title: "Admin and user guides",
        bullets: [
          "Admin documentation tab mirrors /admin/documentation for platform admins.",
          "User documentation tab mirrors public /docs for customers.",
          "Each topic has Quick reference (purpose, how it works, requirements, do-nots) and In-depth guide.",
        ],
      },
      {
        id: "edit-mode",
        title: "Manual edit mode",
        bullets: [
          "Toggle Edit mode to show edit buttons on each topic.",
          "Quick reference edits update purpose, howItWorks, requirements, and doNots.",
          "In-depth edits update intro and section content (paragraphs, bullets, tables).",
          "Overrides persist in documentation_overrides — effective content merges source + DB overrides.",
        ],
      },
      {
        id: "ai-agent",
        title: "Documentation AI agent",
        bullets: [
          "Describe add/update/remove instructions in natural language.",
          "Attach up to 6 UI screenshots for accurate step-by-step writing.",
          "Select Admin documentation, User documentation, or both.",
          "Run agent → review proposed operations → Apply changes (or enable Auto-apply to save immediately).",
          "Operations: update_page, update_article, add_page, add_section, remove_page, update_section.",
        ],
      },
      {
        id: "sync",
        title: "Source files vs runtime overrides",
        paragraphs: [
          "Built-in source files live in src/data/*-documentation*. DB overrides from the manager or AI agent are runtime-only. Developers updating product UI must also edit source files and run npm run docs:baseline for documentation-sync CI checks. The fingerprint system does not hash DB overrides.",
        ],
      },
      {
        id: "search",
        title: "Cross-guide search",
        bullets: [
          "Search panel finds matches across quick reference and in-depth content for both audiences.",
          "Useful for verifying coverage before shipping a feature change.",
        ],
      },
    ],
  ),
];

export const ADMIN_DOCUMENTATION_ARTICLES_BY_PAGE_ID: Readonly<Record<string, DocArticle>> =
  Object.fromEntries(ALL_ARTICLES.map((article) => [article.pageId, article]));

export function getAdminDocumentationArticle(pageId: string): DocArticle | null {
  return ADMIN_DOCUMENTATION_ARTICLES_BY_PAGE_ID[pageId] ?? null;
}

export function hasAdminDocumentationArticle(pageId: string): boolean {
  return pageId in ADMIN_DOCUMENTATION_ARTICLES_BY_PAGE_ID;
}

export const ADMIN_DOCUMENTATION_ARTICLE_COUNT = ALL_ARTICLES.length;
