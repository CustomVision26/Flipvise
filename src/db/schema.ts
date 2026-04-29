import {
  boolean,
  integer,
  pgTable,
  varchar,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
  json,
} from 'drizzle-orm/pg-core';

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

export const cardTypeEnum = pgEnum('card_type', ['standard', 'multiple_choice']);

export const teamMemberRoleEnum = pgEnum('team_member_role', [
  'team_admin',
  'team_member',
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

/** Subscriber-owned team workspace (plan limits apply per owner subscription). */
export const teams = pgTable('teams', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  ownerUserId: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  /** Clerk plan id at creation, e.g. pro_team_basic — used for limits. */
  planSlug: varchar({ length: 64 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
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
  },
  (t) => [
    uniqueIndex('team_deck_assign_uidx').on(t.teamId, t.deckId, t.memberUserId),
  ],
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
  assignedByUserId: varchar({ length: 255 }).notNull(),
  assignedByName: varchar({ length: 255 }).notNull(),
  createdAt: timestamp().notNull().defaultNow(),
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
  adminId: varchar({ length: 255 }).notNull(),
  adminName: varchar({ length: 255 }).notNull(),
  message: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

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
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('billing_invoices_external_id_uidx').on(t.externalId)],
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
  /** Set when the invitee accepts the invitation. */
  inviteAcceptedAt: timestamp(),
  revokedAt: timestamp(),
  revokedByUserId: varchar({ length: 255 }),
  revokedByName: varchar({ length: 255 }),
  createdAt: timestamp().notNull().defaultNow(),
});

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
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export type PerCardSnapshot = {
  cardId: number;
  /** Question / front text shown to the user. */
  question: string | null;
  /** The correct answer text. */
  correctAnswer: string;
  /** What the user selected; null means unanswered. */
  selectedAnswer: string | null;
  correct: boolean;
};

/**
 * Tracks when a user explicitly marks an inbox item as read.
 * Works across all item types (quiz_result, team_invite, billing, affiliate).
 */
export const inboxReads = pgTable(
  'inbox_reads',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    /** Discriminator: 'quiz_result' | 'team_invite' | 'billing' | 'affiliate' */
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
 * One inbox message per saved quiz result.
 * For personal quizzes the recipient is the quiz-taker themselves.
 * For team-deck quizzes the recipient is the team workspace owner.
 */
export const quizResultInboxMessages = pgTable('quiz_result_inbox_messages', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  recipientUserId: varchar({ length: 255 }).notNull(),
  quizResultId: integer()
    .notNull()
    .references(() => quizResults.id, { onDelete: 'cascade' }),
  read: boolean().notNull().default(false),
  createdAt: timestamp().notNull().defaultNow(),
});

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
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});
