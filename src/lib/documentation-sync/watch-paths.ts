/**
 * Extra source files to watch per documentation page (merged with route-derived `page.tsx`).
 * When these files change, quick-reference + in-depth guides for that page must be reviewed.
 */
export const USER_DOC_SUPPLEMENTAL_WATCH_PATHS: Readonly<Record<string, readonly string[]>> = {
  homepage: ["src/components/app-top-nav.tsx"],
  "header-navigation": [
    "src/components/app-top-nav.tsx",
    "src/components/header-user-section.tsx",
  ],
  "team-workspace-dashboard": ["src/app/dashboard/workspace/page.tsx"],
  "deck-editor": [
    "src/app/decks/[deckId]/page.tsx",
    "src/app/decks/[deckId]/card-grid.tsx",
    "src/app/decks/[deckId]/edit-deck-dialog.tsx",
  ],
  "study-session": [
    "src/app/decks/[deckId]/study/page.tsx",
    "src/app/decks/[deckId]/study/quiz-study.tsx",
    "src/lib/quiz-formats.ts",
    "src/lib/quiz-questions.ts",
  ],
  "quiz-result-detail": ["src/app/dashboard/quiz-results/[resultId]/page.tsx"],
  inbox: ["src/components/inbox-unified-client.tsx"],
  "help-center-overview": ["src/components/help-center.tsx"],
  "help-center-support": ["src/components/help-center.tsx", "src/components/contact-support-view.tsx"],
  "help-center-bug-report": ["src/components/help-center.tsx"],
  "help-center-feature-request": ["src/components/help-center.tsx"],
  "help-center-feedback": ["src/components/help-center.tsx"],
  "help-center-billing": ["src/components/help-center.tsx"],
  "help-center-account": ["src/components/help-center.tsx"],
  "help-center-my-tickets": ["src/components/help-center-my-tickets.tsx"],
  "help-center-priority-support": ["src/components/help-center.tsx"],
  "contact-us-page": ["src/components/contact-support-view.tsx"],
  "contact-us-live-chat": ["src/components/contact-support-view.tsx", "src/components/contact-us-thread-view.tsx"],
  "contact-us-guest-vs-signed-in": ["src/components/contact-support-view.tsx"],
  "contact-us-vs-help-center": ["src/components/contact-support-view.tsx", "src/components/help-center.tsx"],
  pricing: ["src/components/pricing-content.tsx", "src/data/plans-config.json"],
  "stripe-billing-payment": [
    "src/actions/stripe.ts",
    "src/components/stripe-checkout-button.tsx",
    "src/app/api/webhooks/stripe/route.ts",
  ],
  checkout: ["src/app/pricing/checkout/page.tsx", "src/actions/stripe.ts"],
  "manage-subscription": ["src/components/user-billing-page.tsx", "src/components/manage-billing-button.tsx"],
  "prorations-plan-changes": ["src/actions/stripe.ts", "src/app/pricing/checkout/plan-change/pay/page.tsx"],
  "promo-general": ["src/data/plans-config.json", "src/components/pricing-content.tsx"],
  "promo-affiliate": ["src/components/affiliate-portal-view.tsx", "src/data/plans-config.json"],
  "promo-seasonal-by-plan": ["src/data/plans-config.json"],
  "clerk-profile": ["src/components/header-user-section.tsx"],
  "appearance-settings": ["src/components/header-user-section.tsx"],
  "billing-tab": ["src/components/user-billing-page.tsx", "src/actions/stripe.ts"],
  "account-delete": ["src/components/account-delete-dialog.tsx"],
  "team-admin-overview": [
    "src/components/team-admin-manage-tabs.tsx",
    "src/components/team-admin-quick-nav-panel.tsx",
  ],
  members: [
    "src/components/team-admin-invitation-tables.tsx",
    "src/components/team-member-table.tsx",
    "src/actions/teams.ts",
  ],
  "deck-manager": [
    "src/components/team-deck-assign-list.tsx",
    "src/components/team-deck-manager-sub-tabs.tsx",
    "src/components/team-quiz-formats-settings.tsx",
    "src/app/dashboard/(team-admin)/team-admin/deck-manager/study-privileges/page.tsx",
    "src/actions/quiz-formats.ts",
    "src/lib/generate-quiz-variants-ai.ts",
  ],
  "invite-members": [
    "src/app/dashboard/(team-admin)/team-admin/invite-members/pending-invitations/page.tsx",
    "src/app/dashboard/(team-admin)/team-admin/invite-members/invitation-history/page.tsx",
  ],
  "quiz-results-admin": [
    "src/app/dashboard/(team-admin)/team-admin/quiz-results/quiz-security/page.tsx",
    "src/app/dashboard/(team-admin)/team-admin/quiz-results/quiz-timer/page.tsx",
    "src/app/dashboard/(team-admin)/team-admin/quiz-results/quiz-schedule/page.tsx",
  ],
  "affiliate-dashboard": ["src/components/affiliate-portal-view.tsx", "src/components/affiliate-invite-inbox-section.tsx"],
};

export const ADMIN_DOC_SUPPLEMENTAL_WATCH_PATHS: Readonly<Record<string, readonly string[]>> = {
  "admin-dashboard-overview": [
    "src/components/admin-overview-stats-collapsible.tsx",
    "src/lib/admin/load-admin-dashboard-data.ts",
  ],
  "all-users": ["src/lib/admin/serialize-admin-users.ts", "src/actions/admin.ts"],
  subscription: ["src/lib/admin/admin-billing-snapshot.ts", "src/db/queries/stripe-subscriptions.ts"],
  invoices: ["src/db/queries/billing.ts"],
  "paid-subscribers": ["src/lib/admin-user-plan-label.ts", "src/db/queries/billing.ts"],
  "team-workspaces": ["src/db/queries/admin.ts"],
  "admin-roles": ["src/actions/admin.ts", "src/lib/platform-superadmin.ts"],
  "audit-log": ["src/db/queries/admin.ts"],
  "support-tickets": ["src/components/admin-support-panel.tsx", "src/db/queries/support.ts"],
  "support-contact-us": [
    "src/components/admin-contact-us-panel.tsx",
    "src/components/admin-contact-us-thread-panel.tsx",
    "src/db/queries/contact-us.ts",
  ],
  "pricing-plans": ["src/components/admin-plans-editor.tsx", "src/data/plans-config.json"],
  "plan-history": ["src/db/queries/admin.ts"],
  "affiliate-messaging": ["src/components/admin-affiliate-promo-broadcast.tsx"],
  "marketing-affiliates": [
    "src/components/admin-affiliates-panel.tsx",
    "src/components/admin-affiliate-quota-panel.tsx",
    "src/db/queries/affiliates.ts",
  ],
};

/** Shared shell for every admin guide page. */
export const ADMIN_DOC_SHARED_WATCH_PATHS: readonly string[] = [
  "src/components/admin-tabs.tsx",
  "src/lib/admin-dashboard-section.ts",
];
