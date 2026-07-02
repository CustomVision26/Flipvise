import type { InferSelectModel } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  varchar,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
  json,
} from 'drizzle-orm/pg-core';
import type { CardQuizVariants, FillInBlankSegment } from '@/lib/card-quiz-variants';
import type { QuizQuestionType } from '@/lib/quiz-questions';

export const supportCategoryEnum = pgEnum('support_category', [
  'general_support',
  'bug_report',
  'feature_request',
  'feedback',
  'billing',
  'account',
]);

export const supportStatusEnum = pgEnum('support_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
]);

export const supportPriorityEnum = pgEnum('support_priority', [
  'low',
  'normal',
  'high',
  'urgent',
]);

export const supportAuthorRoleEnum = pgEnum('support_author_role', ['admin', 'user']);

export const supportNotificationKindEnum = pgEnum('support_notification_kind', [
  'new_ticket',
  'admin_reply',
  'user_reply',
  'status_resolved',
]);

export const contactUsStatusEnum = pgEnum('contact_us_status', [
  'open',
  'read',
  'archived',
]);

export const contactUsAuthorRoleEnum = pgEnum('contact_us_author_role', [
  'admin',
  'user',
]);

export const contactUsNotificationKindEnum = pgEnum('contact_us_notification_kind', [
  'new_message',
  'admin_reply',
  'user_reply',
]);

export const cardTypeEnum = pgEnum('card_type', ['standard', 'multiple_choice']);

export const teamMemberRoleEnum = pgEnum('team_member_role', [
  'team_admin',
  'team_member',
]);

/** Study modes allowed for a team_member deck assignment. */
export const teamMemberStudyPrivilegeEnum = pgEnum('team_member_study_privilege', [
  'standard_review',
  'quiz',
  'both',
]);

export const teamInvitationStatusEnum = pgEnum('team_invitation_status', [
  'pending',
  'accepted',
  'expired',
  'rejected',
  'revoked',
]);

export const teamWorkspaceEventActionEnum = pgEnum('team_workspace_event_action', [
  'created',
  'updated',
  'deleted',
]);

export const quizSecuritySessionStatusEnum = pgEnum('quiz_security_session_status', [
  'active',
  'locked',
  'granted_resume',
  'terminated',
  'completed',
]);

/** Subscriber-owned team workspace (plan limits apply per owner subscription). */
export const teams = pgTable('teams', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ownerUserId: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  /** Clerk plan id at creation, e.g. pro_team_basic — used for limits. */
  planSlug: varchar({ length: 64 }).notNull(),
  /**
   * Workspace-specific quiz timer override (minutes). When null, uses
   * {@link teamOwnerQuizDefaults.defaultQuizDurationMinutes} for the subscriber owner.
   */
  quizDurationMinutes: integer(),
  /** When true, quiz takers cannot leave the study UI until submit; leaving locks the session. */
  quizSecurityEnabled: boolean().notNull().default(false),
  /** When true, quizzes in this workspace cannot start before {@link quizStartAt}. */
  quizStartScheduleEnabled: boolean().notNull().default(false),
  /** Earliest moment members may start a quiz (workspace default when deck schedule is off). */
  quizStartAt: timestamp(),
  /** When true, quizzes may include multiple-choice questions (default on). */
  quizFormatMultipleChoice: boolean().notNull().default(true),
  /** When true, quizzes may include AI-generated true/false statements. */
  quizFormatTrueFalse: boolean().notNull().default(false),
  /** When true, quizzes may include AI-generated fill-in-the-blank sentences. */
  quizFormatFillInBlank: boolean().notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
});

/** Subscriber default timed-quiz length — applies to all owned workspaces without an override. */
export const teamOwnerQuizDefaults = pgTable('team_owner_quiz_defaults', {
  ownerUserId: varchar({ length: 255 }).primaryKey(),
  defaultQuizDurationMinutes: integer().notNull().default(10),
  /**
   * When true, every owned workspace uses {@link defaultQuizDurationMinutes};
   * per-workspace overrides are ignored and cannot be set until turned off.
   */
  enforceDefaultForAllWorkspaces: boolean().notNull().default(false),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const decks = pgTable('decks', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar({ length: 255 }).notNull(),
  /** When set, this deck belongs to a specific team workspace (see `teams`). */
  teamId: integer().references(() => teams.id, { onDelete: 'set null' }),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  /** Optional hero/cover image for team workspace decks (S3 URL). */
  coverImageUrl: text(),
  /** Gradient slug (e.g. "ocean", "sunset") applied to deck tile and study flashcard. */
  gradient: text(),
  /** When true, this deck's quiz cannot start before {@link quizStartAt} (overrides workspace schedule). */
  quizStartScheduleEnabled: boolean().notNull().default(false),
  /** Earliest moment members may start a quiz on this deck. */
  quizStartAt: timestamp(),
  /**
   * Per-deck quiz security override. When null, uses the workspace {@link teams.quizSecurityEnabled}.
   * When true or false, overrides the workspace for this deck only.
   */
  quizSecurityEnabled: boolean(),
  /** Per-deck quiz format overrides — null inherits workspace defaults. */
  quizFormatMultipleChoice: boolean(),
  quizFormatTrueFalse: boolean(),
  quizFormatFillInBlank: boolean(),
  /** Admin-reshuffled per-card quiz format assignments (see DeckQuizFormatAssignments). */
  quizFormatAssignments: json().$type<import("@/lib/quiz-format-assignments").DeckQuizFormatAssignments>(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

/** Active members (owner is teams.ownerUserId, not stored here). */
export const teamMembers = pgTable(
  'team_members',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: varchar({ length: 255 }).notNull(),
    role: teamMemberRoleEnum().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
    /** Set when the member row is created (e.g. invite accept). Omitted for legacy rows. */
    addedByUserId: varchar({ length: 255 }),
    /** True if the adder is the workspace subscriber; false if a co-admin sent the invite. */
    addedByAsOwner: boolean(),
  },
  (t) => [uniqueIndex('team_members_team_user_uidx').on(t.teamId, t.userId)],
);

/** Audit trail for subscriber-owned workspaces (create / rename / delete). */
export const teamWorkspaceEvents = pgTable('team_workspace_events', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ownerUserId: varchar({ length: 255 }).notNull(),
  action: teamWorkspaceEventActionEnum().notNull(),
  /** Team id at event time; kept even after the workspace row is removed. */
  teamId: integer(),
  teamName: varchar({ length: 255 }).notNull(),
  planSlug: varchar({ length: 64 }).notNull(),
  previousTeamName: varchar({ length: 255 }),
  createdAt: timestamp().notNull().defaultNow(),
});

export const teamInvitations = pgTable('team_invitations', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer()
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  /** Clerk user id of the member or owner who sent the invite. */
  invitedByUserId: varchar({ length: 255 }),
  email: varchar({ length: 255 }).notNull(),
  /** Optional label the inviter sets for this email (shown in admin records; not required for delivery). */
  inviteeDisplayName: varchar({ length: 255 }),
  role: teamMemberRoleEnum().notNull(),
  token: varchar({ length: 64 }).notNull().unique(),
  status: teamInvitationStatusEnum().notNull().default('pending'),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

/** Which decks a normal team_member may view/study (owner’s deck ids). */
export const teamDeckAssignments = pgTable(
  'team_deck_assignments',
  {
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    deckId: integer()
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    memberUserId: varchar({ length: 255 }).notNull(),
    /** Clerk user id of owner/co-admin who created this assignment (null for rows before audit). */
    assignedByUserId: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    /** Which study modes this member may use for this deck on the study page. */
    studyPrivilege: teamMemberStudyPrivilegeEnum().notNull().default('both'),
  },
  (t) => [
    uniqueIndex('team_deck_assign_uidx').on(t.teamId, t.deckId, t.memberUserId),
  ],
);

/**
 * Subscriber-owned decks (`decks.userId` = workspace `teams.ownerUserId`) may be linked to
 * multiple owned workspaces; `decks.teamId` stays null for that pattern. Native team-scoped
 * decks may still use `decks.teamId` until normalized via link + null.
 */
export const deckWorkspaceLinks = pgTable(
  'deck_workspace_links',
  {
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    deckId: integer()
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('deck_workspace_links_team_deck_uidx').on(t.teamId, t.deckId)],
);

export const adminPrivilegeActionEnum = pgEnum('admin_privilege_action', [
  'granted',
  'revoked',
  'superadmin_granted',
  'superadmin_revoked',
]);

export const adminPlanAssignmentActionEnum = pgEnum('admin_plan_assignment_action', [
  'plan_assigned',
  'plan_removed',
  'user_banned',
  'user_unbanned',
]);

export const adminPrivilegeLogs = pgTable('admin_privilege_logs', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  targetUserId: varchar({ length: 255 }).notNull(),
  targetUserName: varchar({ length: 255 }).notNull(),
  grantedByUserId: varchar({ length: 255 }).notNull(),
  grantedByName: varchar({ length: 255 }).notNull(),
  action: adminPrivilegeActionEnum().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const adminPlanAssignmentLogs = pgTable('admin_plan_assignment_logs', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  targetUserId: varchar({ length: 255 }).notNull(),
  targetUserName: varchar({ length: 255 }).notNull(),
  targetUserEmail: varchar({ length: 255 }),
  action: adminPlanAssignmentActionEnum().notNull(),
  /** Human-readable new plan name (e.g. "Pro", "Team Basic", "Free"). Null for ban/unban actions. */
  planName: varchar({ length: 128 }),
  /** Human-readable previous plan name before the change. Null when no prior plan exists. */
  previousPlanName: varchar({ length: 128 }),
  /**
   * How the plan change was applied (Assign plan on All users). Null for legacy rows / ban logs.
   * `stripe_proration` — subscription price swapped with proration; `clerk_metadata_only` — metadata grant only.
   */
  planApplicationPath: varchar({ length: 32 }),
  assignedByUserId: varchar({ length: 255 }).notNull(),
  assignedByName: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

export const adminPlanAssignmentInviteStatusEnum = pgEnum('admin_plan_assignment_invite_status', [
  'pending',
  'accepted',
  'declined',
  'superseded',
]);

/** Pending admin plan offers — applied only after the target user accepts in the inbox. */
export const adminPlanAssignmentInvites = pgTable('admin_plan_assignment_invites', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  targetUserId: varchar({ length: 255 }).notNull(),
  assignedByUserId: varchar({ length: 255 }).notNull(),
  assignedByName: varchar({ length: 255 }).notNull(),
  targetUserName: varchar({ length: 255 }).notNull(),
  /** Plan slug (same values as AdminPlanAssignment). */
  assignment: varchar({ length: 64 }).notNull(),
  /** Snapshot of target effective plan slug when the admin sent the offer (for inbox copy). */
  previousPlanSlug: varchar({ length: 64 }),
  status: adminPlanAssignmentInviteStatusEnum().notNull().default('pending'),
  createdAt: timestamp().notNull().defaultNow(),
  respondedAt: timestamp(),
});

export const deactivated = pgTable('deactivated', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar({ length: 255 }).notNull().unique(),
  userName: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }),
  deactivatedByUserId: varchar({ length: 255 }).notNull(),
  deactivatedByName: varchar({ length: 255 }).notNull(),
  reason: text(),
  deactivatedAt: timestamp().notNull().defaultNow(),
});

export const supportTickets = pgTable('support_tickets', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar({ length: 255 }).notNull(),
  userEmail: varchar({ length: 255 }),
  userName: varchar({ length: 255 }),
  subject: varchar({ length: 500 }).notNull(),
  message: text().notNull(),
  category: supportCategoryEnum().notNull(),
  status: supportStatusEnum().notNull().default('open'),
  priority: supportPriorityEnum().notNull().default('normal'),
  attachmentUrl: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const supportTicketReplies = pgTable('support_ticket_replies', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ticketId: integer()
    .notNull()
    .references(() => supportTickets.id, { onDelete: 'cascade' }),
  /** Clerk user id of the message author (admin or ticket owner). */
  authorUserId: varchar({ length: 255 }).notNull(),
  authorName: varchar({ length: 255 }).notNull(),
  authorRole: supportAuthorRoleEnum().notNull().default('admin'),
  /** Legacy admin id column — kept for existing rows; new writes mirror authorUserId. */
  adminId: varchar({ length: 255 }),
  adminName: varchar({ length: 255 }),
  message: text().notNull(),
  /** Optional image attached to this reply (S3 URL). */
  imageUrl: text(),
  createdAt: timestamp().notNull().defaultNow(),
});

/** In-app alerts for platform admins and ticket owners (support thread activity). */
export const supportTicketNotifications = pgTable(
  'support_ticket_notifications',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: varchar({ length: 255 }).notNull(),
    ticketId: integer()
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    kind: supportNotificationKindEnum().notNull(),
    preview: varchar({ length: 500 }).notNull(),
    readAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('support_ticket_notifications_recipient_idx').on(t.recipientUserId),
    index('support_ticket_notifications_ticket_idx').on(t.ticketId),
  ],
);

/** Singleton row — public contact details shown on `/contact`. */
export const platformContactSettings = pgTable('platform_contact_settings', {
  id: integer().primaryKey().default(1),
  email: varchar({ length: 255 }).notNull(),
  phone: varchar({ length: 64 }),
  socialLinks: json().$type<
    { platform: string; label: string; url: string }[]
  >().notNull().default([]),
  updatedAt: timestamp().notNull().defaultNow(),
  updatedByUserId: varchar({ length: 255 }),
});

/** Messages submitted from the public Contact Us page. */
export const contactUsMessages = pgTable(
  'contact_us_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    subject: varchar({ length: 500 }).notNull(),
    message: text().notNull(),
    userId: varchar({ length: 255 }),
    /** Guest thread access — required to open `/contact/thread/[id]` without sign-in. */
    accessToken: varchar({ length: 64 }).notNull(),
    status: contactUsStatusEnum().notNull().default('open'),
    readAt: timestamp(),
    readByUserId: varchar({ length: 255 }),
    /** Last heartbeat while a guest has `/contact/thread/[id]` open in the browser. */
    guestChatLastSeenAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('contact_us_messages_status_idx').on(t.status),
    uniqueIndex('contact_us_messages_access_token_uidx').on(t.accessToken),
  ],
);

export const contactUsReplies = pgTable(
  'contact_us_replies',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    messageId: integer()
      .notNull()
      .references(() => contactUsMessages.id, { onDelete: 'cascade' }),
    authorUserId: varchar({ length: 255 }),
    authorName: varchar({ length: 255 }).notNull(),
    authorRole: contactUsAuthorRoleEnum().notNull(),
    message: text().notNull(),
    imageUrl: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index('contact_us_replies_message_idx').on(t.messageId)],
);

/** In-app alerts for platform admins and users on Contact Us thread activity. */
export const contactUsNotifications = pgTable(
  'contact_us_notifications',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: varchar({ length: 255 }).notNull(),
    messageId: integer()
      .notNull()
      .references(() => contactUsMessages.id, { onDelete: 'cascade' }),
    kind: contactUsNotificationKindEnum().notNull().default('new_message'),
    preview: varchar({ length: 500 }).notNull(),
    readAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('contact_us_notifications_recipient_idx').on(t.recipientUserId),
    index('contact_us_notifications_message_idx').on(t.messageId),
  ],
);

export const billingInvoices = pgTable(
  'billing_invoices',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    /** Clerk invoice id or payment attempt id (stable external reference). */
    externalId: varchar({ length: 255 }).notNull(),
    /** Source kind from Clerk webhook / API normalization. */
    source: varchar({ length: 32 }).notNull(),
    userId: varchar({ length: 255 }).notNull(),
    userEmail: varchar({ length: 255 }),
    planSlug: varchar({ length: 128 }),
    invoiceNumber: varchar({ length: 128 }),
    status: varchar({ length: 64 }).notNull().default('unknown'),
    /** Total charged (after tax). Matches Stripe invoice.amount_paid. */
    amountCents: integer(),
    /** Subtotal before tax. Matches Stripe invoice.subtotal. */
    subtotalCents: integer(),
    /** Tax collected in cents. Matches Stripe invoice.tax. */
    taxAmountCents: integer(),
    currency: varchar({ length: 16 }),
    hostedInvoiceUrl: text(),
    invoicePdfUrl: text(),
    periodStart: timestamp(),
    periodEnd: timestamp(),
    paidAt: timestamp(),
    /** Total discount applied in cents (sum of Stripe total_discount_amounts). */
    discountAmountCents: integer(),
    /** Human-readable coupon/discount label (e.g. "LAUNCH50 — 50% off"). */
    discountLabel: varchar({ length: 255 }),
    /** Customer-facing promo code entered at checkout (e.g. SUMMER26 or combined affiliate code). */
    promoCode: varchar({ length: 128 }),
    /** `general` or `affiliate` — distinguishes tier promo vs affiliate combined code. */
    promoKind: varchar({ length: 16 }),
    /** Stripe-only: invoice.billing_reason (e.g. subscription_cycle, subscription_update). */
    stripeBillingReason: varchar({ length: 64 }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('billing_invoices_external_id_uidx').on(t.externalId)],
);

/**
 * Stripe invoice line items marked proration=true (plan changes, credits).
 * Parent receipt URLs live on billing_invoices (same stripeInvoiceId as externalId).
 */
export const billingProrationLines = pgTable(
  'billing_proration_lines',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    /** Stripe invoice id in_… */
    stripeInvoiceId: varchar({ length: 255 }).notNull(),
    /** Stripe line item id il_… */
    stripeLineId: varchar({ length: 255 }).notNull().unique(),
    amountCents: integer(),
    currency: varchar({ length: 16 }),
    description: text(),
    periodStart: timestamp(),
    periodEnd: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
  },
);

export const affiliateStatusEnum = pgEnum('affiliate_status', ['pending', 'active', 'revoked']);

/** Marketing affiliates invited by an admin to promote the platform. */
export const affiliates = pgTable('affiliates', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** Email address the invite was sent to. */
  invitedEmail: varchar({ length: 255 }).notNull(),
  /** Clerk user ID once the invitee creates an account — set via webhook or manually. */
  invitedUserId: varchar({ length: 255 }),
  affiliateName: varchar({ length: 255 }).notNull(),
  /** Plan slug granted for the affiliate period (e.g. "pro", "pro_team_basic"). */
  planAssigned: varchar({ length: 64 }).notNull(),
  startedAt: timestamp().notNull().defaultNow(),
  endsAt: timestamp().notNull(),
  addedByUserId: varchar({ length: 255 }).notNull(),
  addedByName: varchar({ length: 255 }).notNull(),
  status: affiliateStatusEnum().notNull().default('pending'),
  /** Unique token sent in the invite link; used to accept the invitation. */
  token: varchar({ length: 64 }).unique(),
  /**
   * After this instant, the invite link and accept action are rejected (plan grant `endsAt` is separate).
   */
  inviteExpiresAt: timestamp().notNull(),
  /** Set when the invitee accepts the invitation. */
  inviteAcceptedAt: timestamp(),
  revokedAt: timestamp(),
  revokedByUserId: varchar({ length: 255 }),
  revokedByName: varchar({ length: 255 }),
  createdAt: timestamp().notNull().defaultNow(),
  /**
   * Unique code used in combined Stripe promotion strings (e.g. SummerLaunch + this code).
   * Stored lowercase; allocated when the affiliate row is created.
   */
  promotionalCode: varchar({ length: 64 }).notNull().unique(),
  /** Lifetime count of paid subscriptions attributed via checkout metadata. */
  paidReferralsTotal: integer().notNull().default(0),
  /** Paid referrals in the month keyed by `paidReferralsMonthKey`. */
  paidReferralsMonth: integer().notNull().default(0),
  /** Calendar month for `paidReferralsMonth`, format `YYYY-MM`. */
  paidReferralsMonthKey: varchar({ length: 7 }),
  /** When true, plan auto-renews at period end if `periodPaidReferrals` ≥ `referralQuotaTarget`. */
  referralQuotaEnabled: boolean().notNull().default(false),
  /** Required paid referrals in the current quota period (admin-set). */
  referralQuotaTarget: integer(),
  /** Paid referrals counted toward the current quota period. */
  periodPaidReferrals: integer().notNull().default(0),
  /** Start of the current quota measurement window (defaults to arrangement start when enabled). */
  quotaPeriodStartedAt: timestamp(),
  /** Proposed plan after admin edits an active affiliate; applied only after confirmation. */
  pendingPlanAssigned: varchar({ length: 64 }),
  pendingEndsAt: timestamp(),
  /** Token for `/affiliate/confirm-arrangement?token=` (separate from pending-invite token). */
  arrangementChangeToken: varchar({ length: 64 }).unique(),
  arrangementChangeExpiresAt: timestamp(),
});

/**
 * Admin promo inbox broadcasts (`recipientUserId` = Clerk user id). General variant may fan out to all users;
 * codes variant is affiliate-targeted.
 */
export const affiliateBroadcastInboxMessages = pgTable(
  'affiliate_broadcast_inbox_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: varchar({ length: 255 }).notNull(),
    /** `general` — public coupon summary; `codes` — combined promotional codes. */
    variant: varchar({ length: 16 }).notNull(),
    subject: varchar({ length: 200 }).notNull(),
    messageBody: text().notNull(),
    /** Public promo summary or per-affiliate combined-code lines (shown in inbox). */
    detailsBlock: text().notNull(),
    pricingPageUrl: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index('affiliate_broadcast_inbox_messages_recipient_idx').on(t.recipientUserId)],
);

/**
 * Post-checkout subscription confirmation shown in the user inbox (distinct from invoice rows).
 * One row per Stripe Checkout Session (`cs_…`).
 */
export const subscriptionCheckoutConfirmations = pgTable(
  'subscription_checkout_confirmations',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    checkoutSessionId: varchar({ length: 255 }).notNull(),
    planSlug: varchar({ length: 128 }).notNull(),
    planLabel: varchar({ length: 128 }).notNull(),
    /** `monthly` or `yearly` from checkout metadata. */
    period: varchar({ length: 16 }).notNull(),
    amountCents: integer(),
    currency: varchar({ length: 16 }),
    promoDisplay: varchar({ length: 255 }),
    receiptUrl: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('subscription_checkout_confirmations_session_uidx').on(
      t.checkoutSessionId,
    ),
    index('subscription_checkout_confirmations_user_idx').on(t.userId),
  ],
);

/**
 * One row per Clerk user who has (or had) a Stripe subscription.
 * Upserted by the Stripe webhook on checkout.session.completed and kept
 * in sync via customer.subscription.updated / customer.subscription.deleted.
 * Used to look up the active subscription when applying proration.
 */
export const stripeSubscriptions = pgTable('stripe_subscriptions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** Clerk user ID — unique; one active subscription row per user. */
  userId: varchar({ length: 255 }).notNull().unique(),
  /** Stripe Customer ID (cus_…). */
  stripeCustomerId: varchar({ length: 255 }).notNull(),
  /** Stripe Subscription ID (sub_…). */
  stripeSubscriptionId: varchar({ length: 255 }).notNull().unique(),
  /** Stripe Subscription Item ID (si_…) — required for price swap on proration. */
  stripeSubscriptionItemId: varchar({ length: 255 }),
  /** Plan slug matching the price currently on the subscription. */
  planSlug: varchar({ length: 64 }),
  /** Mirrors the Stripe subscription status field. */
  status: varchar({ length: 64 }).notNull().default('active'),
  /** When the current billing period ends (Unix-epoch seconds stored as timestamp). */
  currentPeriodEnd: timestamp(),
  /** Stripe trial end (when status is `trialing`). */
  trialEnd: timestamp(),
  /** Set when Stripe reports `past_due` — starts the 12-hour payment grace window. */
  paymentFailedAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

/**
 * Records each user's one-time plan trial (enforced at checkout).
 * A user may only start a published trial once across all plans.
 */
export const userPlanTrials = pgTable('user_plan_trials', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar({ length: 255 }).notNull().unique(),
  planSlug: varchar({ length: 64 }).notNull(),
  stripeSubscriptionId: varchar({ length: 255 }),
  startedAt: timestamp().notNull().defaultNow(),
  trialEndsAt: timestamp().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

/**
 * Billing lifecycle notices (trial ending, trial expired, payment grace) delivered
 * in the user dashboard inbox — one row per recipient / notice kind / subscription.
 */
export const billingNoticeInboxMessages = pgTable(
  'billing_notice_inbox_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: varchar({ length: 255 }).notNull(),
    noticeKind: varchar({ length: 32 }).notNull(),
    stripeSubscriptionId: varchar({ length: 255 }).notNull(),
    planSlug: varchar({ length: 64 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    eventAt: timestamp().notNull(),
    requiresAction: boolean().notNull().default(true),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('billing_notice_inbox_recipient_idx').on(t.recipientUserId),
    uniqueIndex('billing_notice_inbox_dedupe_uidx').on(
      t.recipientUserId,
      t.noticeKind,
      t.stripeSubscriptionId,
    ),
  ],
);

/**
 * Long-lived per-device tokens that let the bundled offline mobile app authenticate to
 * `/api/sync` without a Clerk session cookie. Minted from an authenticated session
 * (see `createDeviceSyncTokenAction`); only the SHA-256 hash is stored. Revoked on
 * account deletion.
 */
export const deviceSyncTokens = pgTable(
  'device_sync_tokens',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    /** SHA-256 hex of the raw token (the raw value is shown to the device once). */
    tokenHash: varchar({ length: 64 }).notNull().unique(),
    /** Optional human label (e.g. device/platform). */
    label: varchar({ length: 128 }),
    createdAt: timestamp().notNull().defaultNow(),
    lastUsedAt: timestamp(),
    revokedAt: timestamp(),
  },
  (t) => [index('device_sync_tokens_user_idx').on(t.userId)],
);

export type PerCardSnapshot = {
  cardId: number;
  /** Question / front text shown to the user. */
  question: string | null;
  /** Quiz format used for this question when the result was saved. */
  questionType?: "multiple_choice" | "true_false" | "fill_in_blank";
  /** The correct answer text. */
  correctAnswer: string;
  /** What the user selected; null means unanswered. */
  selectedAnswer: string | null;
  correct: boolean;
};

/**
 * Tracks when a user explicitly marks an inbox item as read.
 * `itemType` / `itemId` match unified inbox keys (e.g. `admin_plan_log` + log id, `affiliate_notice` + `revoked-{id}`, `affiliate_broadcast` + message id).
 */
export const inboxReads = pgTable(
  'inbox_reads',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    /** Discriminator: quiz_result, team_invite, billing, affiliate, affiliate_notice, admin_plan_log, admin_plan_invite */
    itemType: varchar({ length: 64 }).notNull(),
    /** The numeric ID of the item as a string. */
    itemId: varchar({ length: 255 }).notNull(),
    readAt: timestamp().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('inbox_reads_uidx').on(t.userId, t.itemType, t.itemId)],
);

/** Saved quiz attempt — persisted when a user opts in on the result screen. */
export const quizResults = pgTable('quiz_results', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  /** Clerk user ID of the person who took the quiz. */
  userId: varchar({ length: 255 }).notNull(),
  /** FK to the deck; set null if the deck is later deleted. */
  deckId: integer().references(() => decks.id, { onDelete: 'set null' }),
  /** Snapshot of the deck name at save time. */
  deckName: varchar({ length: 255 }).notNull(),
  /** Set when the quiz was taken on a team-owned deck. */
  teamId: integer().references(() => teams.id, { onDelete: 'set null' }),
  correct: integer().notNull(),
  incorrect: integer().notNull(),
  unanswered: integer().notNull(),
  total: integer().notNull(),
  /** Rounded integer 0-100. */
  percent: integer().notNull(),
  elapsedSeconds: integer().notNull().default(0),
  /**
   * Per-card breakdown snapshot — array of { cardId, question, correctAnswer, selectedAnswer, correct }.
   * Stored as JSON so the full review is available even after cards are edited or deleted.
   */
  perCard: json().$type<PerCardSnapshot[]>(),
  savedAt: timestamp().notNull().defaultNow(),
});

/**
 * Inbox rows for saved quiz results (multiple rows may share the same `quizResultId`).
 * The quiz-taker always gets one row; for team-deck quizzes the workspace owner gets a second row when the taker is not the owner.
 */
/** Serialized quiz progress for secured team-workspace quiz sessions. */
export type QuizSecuritySessionState = {
  questions: {
    type: QuizQuestionType;
    cardId: number;
    question: string | null;
    questionImageUrl: string | null;
    options: string[];
    correctIndex: number;
    statement?: string;
    correctAnswer?: boolean;
    segments?: FillInBlankSegment[];
  }[];
  /** Choice index for MC/TF; null when unanswered or FIB. */
  selectedByIndex: (number | null)[];
  /** Typed answers for fill-in-the-blank questions. */
  typedAnswersByIndex: (string | null)[];
  currentIndex: number;
  remainingSeconds: number;
};

export const quizSecuritySessions = pgTable(
  'quiz_security_sessions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    deckId: integer().references(() => decks.id, { onDelete: 'set null' }),
    deckName: varchar({ length: 255 }).notNull(),
    status: quizSecuritySessionStatusEnum().notNull().default('active'),
    sessionState: json().$type<QuizSecuritySessionState>(),
    lockedAt: timestamp(),
    terminatedAt: timestamp(),
    completedAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('quiz_security_sessions_team_status_idx').on(t.teamId, t.status),
    index('quiz_security_sessions_user_deck_idx').on(t.userId, t.deckId),
  ],
);

/** Inbox rows when a secured quiz session is terminated for leaving the UI. */
export const quizSecurityInboxMessages = pgTable(
  'quiz_security_inbox_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: varchar({ length: 255 }).notNull(),
    sessionId: integer()
      .notNull()
      .references(() => quizSecuritySessions.id, { onDelete: 'cascade' }),
    read: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index('quiz_security_inbox_recipient_idx').on(t.recipientUserId)],
);

export const quizResultInboxMessages = pgTable('quiz_result_inbox_messages', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  recipientUserId: varchar({ length: 255 }).notNull(),
  quizResultId: integer()
    .notNull()
    .references(() => quizResults.id, { onDelete: 'cascade' }),
  read: boolean().notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
});

export const documentationAudienceEnum = pgEnum('documentation_audience', ['user', 'admin']);

export const documentationContentKindEnum = pgEnum('documentation_content_kind', [
  'quick_reference_page',
  'in_depth_article',
  'page_addition',
  'page_removal',
  'section_addition',
  'section_metadata',
]);

/** Platform-admin edits to static user/admin documentation (merged at read time). */
export const documentationOverrides = pgTable(
  'documentation_overrides',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    audience: documentationAudienceEnum().notNull(),
    contentKind: documentationContentKindEnum().notNull(),
    pageId: varchar({ length: 128 }).notNull(),
    payload: json().notNull(),
    updatedByUserId: varchar({ length: 255 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('documentation_overrides_audience_kind_page_idx').on(
      table.audience,
      table.contentKind,
      table.pageId,
    ),
  ],
);

export const cards = pgTable('cards', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  deckId: integer()
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  front: text(),
  frontImageUrl: text(),
  back: text(),
  backImageUrl: text(),
  /** True when the card was created by AI generation (not manual add). */
  aiGenerated: boolean().notNull().default(false),
  /** Card format: standard Q&A or multiple choice. */
  cardType: cardTypeEnum().notNull().default('standard'),
  /** For multiple-choice cards: 4 options. First element is the correct answer. Null for standard cards. */
  choices: text().array(),
  /** Index into `choices` pointing to the correct answer (0..3). Null for standard cards. */
  correctChoiceIndex: integer(),
  /** AI-generated true/false and fill-in-the-blank quiz content for this card. */
  quizVariants: json().$type<CardQuizVariants>(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

/** Row shapes for client `import type` — avoids bundling table refs into client runtime chunks. */
export type TeamInvitationRow = InferSelectModel<typeof teamInvitations>;
export type TeamMemberRow = InferSelectModel<typeof teamMembers>;
export type DeckRow = InferSelectModel<typeof decks>;
export type TeamDeckAssignmentRow = InferSelectModel<typeof teamDeckAssignments>;
