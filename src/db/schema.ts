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
import type { LessonPlanInput, LessonPlanResult, StudyGuideResult } from '@/lib/teacher-generators';
import type {
  HomeworkResult,
  HomeworkSourceType,
  TeacherHomeworkActionInput,
} from '@/lib/teacher-homework-ai-schema';
import type { TeacherStudyGuideActionInput } from '@/lib/teacher-study-guide-ai-schema';
import type {
  DeckWorksheetResult,
  TeacherWorksheetActionInput,
} from '@/lib/teacher-worksheet-schema';
import type { LessonPlanReferenceMaterial } from '@/lib/lesson-plan-reference-material';
import type { PlanReconciliationSnapshot } from '@/lib/plan-reconciliation-types';
import type {
  EssayFeedbackResult,
  EssayGenerateInput,
  EssayGenerationResult,
} from '@/lib/essay-ai-schema';

export type SavedHomeworkGenerationInput = Pick<
  TeacherHomeworkActionInput,
  | 'sourceType'
  | 'savedLessonPlanId'
  | 'deckId'
  | 'subject'
  | 'gradeLevel'
  | 'topic'
  | 'numberOfQuestions'
  | 'numberOfPassages'
  | 'questionsPerPassage'
  | 'difficultyLevel'
  | 'dayScope'
> & {
  referenceMaterials?: LessonPlanReferenceMaterial[];
};

export type SavedStudyGuideGenerationInput = Pick<
  TeacherStudyGuideActionInput,
  | 'subject'
  | 'gradeLevel'
  | 'topic'
  | 'savedLessonPlanId'
  | 'savedHomeworkId'
  | 'referenceMaterials'
  | 'dayScope'
>;

export type SavedWorksheetGenerationInput = Pick<
  TeacherWorksheetActionInput,
  | 'deckId'
  | 'subject'
  | 'gradeLevel'
  | 'topic'
  | 'worksheetType'
  | 'difficultyLevel'
  | 'numberOfQuestions'
> & {
  referenceMaterials?: LessonPlanReferenceMaterial[];
};

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
  'ai_recall',
  'quiz',
  'review_and_ai_recall',
  'both',
  'ai_recall_and_quiz',
  'all',
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

export const teamMemberHistoryActionEnum = pgEnum('team_member_history_action', [
  'added',
  'removed',
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
  /**
   * When quiz security is on, apply restrictions to invited `team_member` roles.
   * Plan owner is always restricted when security is on.
   */
  quizSecurityApplyToMembers: boolean().notNull().default(true),
  /**
   * When quiz security is on, apply restrictions to invited `team_admin` roles.
   * Plan owner is always restricted when security is on.
   */
  quizSecurityApplyToTeamAdmins: boolean().notNull().default(false),
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
  /**
   * Max cards shown in an AI Recall™ session for this workspace.
   * Null = use every card in the deck.
   */
  aiRecallSessionCardCount: integer(),
  createdAt: timestamp().notNull().defaultNow(),
  /** Set when owner marks workspace inactive during plan reconciliation (restorable on upgrade). */
  inactiveAt: timestamp(),
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
  /** Optional grade level label (e.g. Grade 6, Year 1). */
  gradeLevel: varchar({ length: 64 }),
  /** Optional difficulty tier for AI generation and teacher tools. */
  difficultyLevel: varchar({ length: 32 }),
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
  /**
   * Per-deck audience override. Null inherits workspace {@link teams.quizSecurityApplyToMembers}.
   */
  quizSecurityApplyToMembers: boolean(),
  /**
   * Per-deck audience override. Null inherits workspace {@link teams.quizSecurityApplyToTeamAdmins}.
   */
  quizSecurityApplyToTeamAdmins: boolean(),
  /** Per-deck quiz format overrides — null inherits workspace defaults. */
  quizFormatMultipleChoice: boolean(),
  quizFormatTrueFalse: boolean(),
  quizFormatFillInBlank: boolean(),
  /** Admin-reshuffled per-card quiz format assignments (see DeckQuizFormatAssignments). */
  quizFormatAssignments: json().$type<import("@/lib/quiz-format-assignments").DeckQuizFormatAssignments>(),
  /**
   * When set, Team Admin has shuffled quiz card order for assignees (see {@link quizCardOrders}).
   * Used for lobby / settings “shuffle in effect” indicators.
   */
  quizCardOrderShuffledAt: timestamp(),
  /** Personal timed-quiz length in minutes. Null uses auto duration from card count. */
  quizDurationMinutes: integer(),
  /**
   * Per-deck AI Recall™ session card limit.
   * Null = inherit workspace {@link teams.aiRecallSessionCardCount}.
   * 0 = all cards (explicit override). 1–100 = fixed count.
   */
  aiRecallSessionCardCount: integer(),
  /** Clerk user id of who created the deck row (co-admin on education workspaces; owner on personal/owner-created). */
  createdByUserId: varchar({ length: 255 }),
  /** Set when owner marks deck inactive during plan reconciliation. */
  inactiveAt: timestamp(),
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
    /** Set when owner marks member inactive during plan reconciliation. */
    inactiveAt: timestamp(),
    /**
     * Education Gold / Enterprise — owner-set cap on decks this `team_admin` may create
     * in the workspace (`createdByUserId`). Null = use the workspace plan deck limit.
     */
    maxCreateDecks: integer(),
  },
  (t) => [uniqueIndex('team_members_team_user_uidx').on(t.teamId, t.userId)],
);

/** Audit trail for workspace membership (member added / removed). */
export const teamMemberHistory = pgTable('team_member_history', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  teamId: integer()
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  ownerUserId: varchar({ length: 255 }).notNull(),
  action: teamMemberHistoryActionEnum().notNull(),
  memberUserId: varchar({ length: 255 }).notNull(),
  memberRole: teamMemberRoleEnum().notNull(),
  /** Clerk user id of who added or removed the member. */
  actorUserId: varchar({ length: 255 }),
  createdAt: timestamp().notNull().defaultNow(),
});

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
    studyPrivilege: teamMemberStudyPrivilegeEnum().notNull().default('all'),
  },
  (t) => [
    uniqueIndex('team_deck_assign_uidx').on(t.teamId, t.deckId, t.memberUserId),
  ],
);

/**
 * Per-viewer quiz card presentation order for a workspace deck.
 * Generated by Team Admin / owner Shuffle so each assignee gets a distinct sequence.
 */
export const quizCardOrders = pgTable(
  'quiz_card_orders',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    deckId: integer()
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    viewerUserId: varchar({ length: 255 }).notNull(),
    /** Card ids in presentation order for this viewer. */
    cardIds: json().$type<number[]>().notNull(),
    shuffledAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('quiz_card_orders_team_deck_viewer_uidx').on(
      t.teamId,
      t.deckId,
      t.viewerUserId,
    ),
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

/**
 * Records when a platform admin opens a user's profile dialog (double-click on All Users)
 * to view phone, type/status, and security Q&A.
 */
export const adminUserProfileAccessLogs = pgTable(
  'admin_user_profile_access_logs',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    targetUserId: varchar({ length: 255 }).notNull(),
    accessedByUserId: varchar({ length: 255 }).notNull(),
    accessedByName: varchar({ length: 255 }).notNull(),
    accessedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('admin_user_profile_access_target_idx').on(t.targetUserId),
    index('admin_user_profile_access_accessed_at_idx').on(t.accessedAt),
  ],
);

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
 * Audit ledger when a paid subscriber deletes their account before period end.
 * Survives user purge — used by admin Billing monitor for manual refunds/receipts.
 */
export const accountDeletionProrationLedger = pgTable(
  'account_deletion_proration_ledger',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    clerkUserId: varchar({ length: 255 }).notNull(),
    userEmail: varchar({ length: 320 }),
    userDisplayName: varchar({ length: 255 }),
    stripeCustomerId: varchar({ length: 255 }).notNull(),
    stripeSubscriptionId: varchar({ length: 255 }).notNull(),
    stripeInvoiceId: varchar({ length: 255 }),
    planSlug: varchar({ length: 64 }),
    subscriptionPeriodEnd: timestamp(),
    deletedAt: timestamp().notNull().defaultNow(),
    estimatedRefundCents: integer().notNull().default(0),
    refundedCents: integer(),
    currency: varchar({ length: 8 }).notNull().default('usd'),
    /** auto_issued | auto_failed | pending_manual | manual_issued | not_applicable */
    refundStatus: varchar({ length: 32 }).notNull(),
    stripeRefundId: varchar({ length: 255 }),
    refundError: text(),
    receiptSentAt: timestamp(),
    receiptSentByAdminUserId: varchar({ length: 255 }),
    manualRefundByAdminUserId: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('account_deletion_proration_sub_uidx').on(t.stripeSubscriptionId),
    index('account_deletion_proration_status_idx').on(t.refundStatus),
    index('account_deletion_proration_deleted_at_idx').on(t.deletedAt),
  ],
);

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

/** One-time welcome message delivered to new accounts in the dashboard inbox. */
export const welcomeInboxMessages = pgTable(
  'welcome_inbox_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: varchar({ length: 255 }).notNull(),
    title: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('welcome_inbox_recipient_uidx').on(t.recipientUserId),
    index('welcome_inbox_recipient_idx').on(t.recipientUserId),
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

/** FCM/APNs device tokens for native push notifications (Capacitor app). */
export const nativePushTokens = pgTable(
  'native_push_tokens',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    /** FCM registration token (works for both Android and iOS via Firebase). */
    token: varchar({ length: 512 }).notNull().unique(),
    platform: varchar({ length: 16 }).notNull(),
    appVersion: varchar({ length: 32 }),
    label: varchar({ length: 128 }),
    createdAt: timestamp().notNull().defaultNow(),
    lastUsedAt: timestamp(),
    revokedAt: timestamp(),
  },
  (t) => [
    index('native_push_tokens_user_idx').on(t.userId),
    index('native_push_tokens_token_idx').on(t.token),
  ],
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
    optionImageUrls?: (string | null)[];
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
  /** Optional image URL for the correct MC answer (`choices[correctChoiceIndex]`). */
  choiceImageUrls: text().array(),
  /** Index into `choices` pointing to the correct answer (0..3). Null for standard cards. */
  correctChoiceIndex: integer(),
  /** AI-generated true/false and fill-in-the-blank quiz content for this card. */
  quizVariants: json().$type<CardQuizVariants>(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

/** Teacher-saved AI lesson plans (personal library per Clerk user). */
export const savedLessonPlans = pgTable(
  'saved_lesson_plans',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    lessonTitle: varchar({ length: 512 }).notNull(),
    subject: varchar({ length: 255 }).notNull(),
    gradeLevel: varchar({ length: 64 }).notNull(),
    topic: varchar({ length: 255 }).notNull(),
    difficultyLevel: varchar({ length: 32 }).notNull(),
    input: json().$type<LessonPlanInput>().notNull(),
    result: json().$type<LessonPlanResult>().notNull(),
    pdfUrl: text(),
    pdfFileName: varchar({ length: 255 }),
    vocabularyDetailPdfUrl: text(),
    vocabularyDetailPdfFileName: varchar({ length: 255 }),
    deckId: integer(),
    sourceDeckName: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index('saved_lesson_plans_user_id_idx').on(table.userId)],
);

/** Teacher-saved AI homework assignments (personal library per Clerk user). */
export const savedHomeworkAssignments = pgTable(
  'saved_homework_assignments',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    label: varchar({ length: 255 }).notNull(),
    assignmentTitle: varchar({ length: 512 }).notNull(),
    subject: varchar({ length: 255 }).notNull(),
    gradeLevel: varchar({ length: 64 }).notNull(),
    topic: varchar({ length: 255 }).notNull(),
    difficultyLevel: varchar({ length: 32 }).notNull(),
    sourceType: varchar({ length: 32 }).$type<HomeworkSourceType>().notNull(),
    savedLessonPlanId: integer(),
    sourceLessonPlanTitle: varchar({ length: 512 }),
    deckId: integer(),
    sourceDeckName: varchar({ length: 255 }),
    input: json().$type<SavedHomeworkGenerationInput>().notNull(),
    result: json().$type<HomeworkResult>().notNull(),
    pdfUrl: text(),
    pdfFileName: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index('saved_homework_assignments_user_id_idx').on(table.userId)],
);

/** Teacher-saved AI study guides (personal library per Clerk user). */
export const savedStudyGuides = pgTable(
  'saved_study_guides',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    label: varchar({ length: 255 }).notNull(),
    guideTitle: varchar({ length: 512 }).notNull(),
    subject: varchar({ length: 255 }).notNull(),
    gradeLevel: varchar({ length: 64 }).notNull(),
    topic: varchar({ length: 255 }).notNull(),
    savedLessonPlanId: integer(),
    sourceLessonPlanTitle: varchar({ length: 512 }),
    savedHomeworkId: integer(),
    sourceHomeworkLabel: varchar({ length: 255 }),
    input: json().$type<SavedStudyGuideGenerationInput>().notNull(),
    result: json().$type<StudyGuideResult>().notNull(),
    pdfUrl: text(),
    pdfFileName: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index('saved_study_guides_user_id_idx').on(table.userId)],
);

/** Teacher-saved deck worksheets with student + answer key PDFs. */
export const savedWorksheets = pgTable(
  'saved_worksheets',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    label: varchar({ length: 255 }).notNull(),
    worksheetTitle: varchar({ length: 512 }).notNull(),
    subject: varchar({ length: 255 }).notNull(),
    gradeLevel: varchar({ length: 64 }).notNull(),
    topic: varchar({ length: 255 }).notNull(),
    worksheetType: varchar({ length: 64 }).notNull(),
    difficultyLevel: varchar({ length: 32 }).notNull(),
    deckId: integer().notNull(),
    sourceDeckName: varchar({ length: 255 }).notNull(),
    input: json().$type<SavedWorksheetGenerationInput>().notNull(),
    result: json().$type<DeckWorksheetResult>().notNull(),
    worksheetPdfUrl: text(),
    worksheetPdfFileName: varchar({ length: 255 }),
    answerKeyPdfUrl: text(),
    answerKeyPdfFileName: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index('saved_worksheets_user_id_idx').on(table.userId)],
);

/** Teacher-saved quiz question sheets + answer keys exported from team quiz results. */
export const savedQuizzes = pgTable(
  'saved_quizzes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    teamId: integer().references(() => teams.id, { onDelete: 'set null' }),
    quizResultId: integer().references(() => quizResults.id, { onDelete: 'set null' }),
    deckId: integer().references(() => decks.id, { onDelete: 'set null' }),
    label: varchar({ length: 255 }).notNull(),
    title: varchar({ length: 512 }).notNull(),
    subject: varchar({ length: 255 }).notNull(),
    gradeLevel: varchar({ length: 64 }).notNull(),
    sourceDeckName: varchar({ length: 255 }).notNull(),
    memberLabel: varchar({ length: 255 }),
    memberEmail: varchar({ length: 255 }),
    perCard: json().$type<PerCardSnapshot[]>().notNull(),
    questionSheetPdfUrl: text(),
    questionSheetPdfFileName: varchar({ length: 255 }),
    answerKeyPdfUrl: text(),
    answerKeyPdfFileName: varchar({ length: 255 }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index('saved_quizzes_user_id_idx').on(table.userId)],
);

/** Teacher class schedules linked to a deck for lesson planning workflows. */
export const teacherClasses = pgTable(
  'teacher_classes',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    /** Education workspace id when the class belongs to a team context. */
    teamId: integer().references(() => teams.id, { onDelete: 'cascade' }),
    deckId: integer()
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    academicYear: varchar({ length: 64 }).notNull(),
    termSemester: varchar({ length: 128 }).notNull(),
    week: varchar({ length: 64 }).notNull(),
    day: varchar({ length: 64 }).notNull(),
    period: varchar({ length: 512 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('teacher_classes_user_id_idx').on(table.userId),
    index('teacher_classes_team_id_idx').on(table.teamId),
    index('teacher_classes_deck_id_idx').on(table.deckId),
  ],
);

/** Education Plus — teacher-registered students (personal roster, not workspace members). */
export const teacherRegisteredStudents = pgTable(
  'teacher_registered_students',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    fullName: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    telephone: varchar({ length: 64 }),
    classId: integer().references(() => teacherClasses.id, { onDelete: 'set null' }),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('teacher_registered_students_user_id_idx').on(table.userId),
    index('teacher_registered_students_class_id_idx').on(table.classId),
  ],
);

/** Education Gold / Enterprise — manually entered assignment grades. */
export const teacherManualGrades = pgTable(
  'teacher_manual_grades',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    teamId: integer().references(() => teams.id, { onDelete: 'cascade' }),
    studentName: varchar({ length: 255 }).notNull(),
    studentEmail: varchar({ length: 255 }),
    assignmentTitle: varchar({ length: 512 }).notNull(),
    grade: varchar({ length: 32 }).notNull(),
    maxGrade: varchar({ length: 32 }),
    subject: varchar({ length: 255 }),
    academicYear: varchar({ length: 64 }).notNull(),
    termSemester: varchar({ length: 128 }).notNull(),
    period: varchar({ length: 64 }),
    notes: text(),
    gradeType: varchar({ length: 32 }).notNull().default("assignment"),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index('teacher_manual_grades_user_id_idx').on(table.userId),
    index('teacher_manual_grades_team_id_idx').on(table.teamId),
  ],
);

export type TeacherRegisteredStudentRow = InferSelectModel<typeof teacherRegisteredStudents>;
export type TeacherManualGradeRow = InferSelectModel<typeof teacherManualGrades>;

export const planReconciliationStatusEnum = pgEnum('plan_reconciliation_status', [
  'pending',
  'completed',
]);

export const planReconciliationTriggerEnum = pgEnum('plan_reconciliation_trigger', [
  'upgrade',
  'downgrade',
  'lateral',
]);

export const planReconciliationSessions = pgTable(
  'plan_reconciliation_sessions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    targetPlanSlug: varchar({ length: 64 }).notNull(),
    previousPlanSlug: varchar({ length: 64 }),
    triggerKind: planReconciliationTriggerEnum().notNull().default('lateral'),
    status: planReconciliationStatusEnum().notNull().default('pending'),
    snapshot: json().$type<PlanReconciliationSnapshot>().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    completedAt: timestamp(),
  },
  (t) => [index('plan_reconciliation_sessions_user_status_idx').on(t.userId, t.status)],
);

/** AI Recall™ card mastery level (automatic — replaces manual Correct/Incorrect grading). */
export const cardMasteryLevelEnum = pgEnum('card_mastery_level', [
  'new',
  'learning',
  'strong',
  'mastered',
]);

/** Per-card mastery for AI Recall™ (and future adaptive study). */
export const cardMastery = pgTable(
  'card_mastery',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    cardId: integer()
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    deckId: integer()
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    level: cardMasteryLevelEnum().notNull().default('new'),
    lastScore: integer(),
    lastOutcome: varchar({ length: 32 }),
    correctStreak: integer().notNull().default(0),
    reviewCount: integer().notNull().default(0),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('card_mastery_user_card_uidx').on(t.userId, t.cardId),
    index('card_mastery_user_deck_idx').on(t.userId, t.deckId),
  ],
);

/** Add-on entitlement source — Stripe paid, platform-admin grant, or team-admin assignment. */
export const addonEntitlementSourceEnum = pgEnum('addon_entitlement_source', [
  'stripe',
  'admin',
  'team',
]);

/** Add-on entitlement lifecycle status. */
export const addonEntitlementStatusEnum = pgEnum('addon_entitlement_status', [
  'active',
  'canceled',
  'revoked',
]);

/**
 * Catalog of optional paid/admin-granted features that stack on top of base plans.
 * Stripe monthly price IDs are resolved from env via `stripePriceEnvKey` (never hardcode price_*).
 */
export const addonCatalog = pgTable(
  'addon_catalog',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    key: varchar({ length: 128 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text().notNull().default(''),
    marketingBlurb: text().notNull().default(''),
    /** Plan slugs eligible to purchase or receive this add-on. */
    eligiblePlanIds: json().$type<string[]>().notNull().default([]),
    /**
     * Env var name holding the Stripe monthly Price id, e.g. `STRIPE_ADDON_STUDY_MODE_XYZ_PRICE_ID`.
     * Empty string means admin-grant-only (no self-serve Checkout).
     */
    stripePriceEnvKey: varchar({ length: 128 }).notNull().default(''),
    /** When false, new purchases and admin assigns are blocked; existing entitlements remain. */
    active: boolean().notNull().default(true),
    /** When true (and settings.pricingCatalogVisible), listed on `/pricing/add-ons`. */
    publishedOnPricing: boolean().notNull().default(false),
    /** When true (and active), shown in the top-header add-ons banner. */
    publishedOnBanner: boolean().notNull().default(true),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('addon_catalog_key_uidx').on(t.key)],
);

/** Singleton — master toggle for showing the Add-on Catalog page on pricing. */
export const addonCatalogSettings = pgTable('addon_catalog_settings', {
  id: integer().primaryKey().default(1),
  pricingCatalogVisible: boolean().notNull().default(false),
  updatedAt: timestamp().notNull().defaultNow(),
  updatedByUserId: varchar({ length: 255 }),
});

/** Per-user active/canceled/revoked add-on entitlements. */
export const userAddonEntitlements = pgTable(
  'user_addon_entitlements',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    addonKey: varchar({ length: 128 }).notNull(),
    source: addonEntitlementSourceEnum().notNull(),
    status: addonEntitlementStatusEnum().notNull().default('active'),
    stripeSubscriptionId: varchar({ length: 255 }),
    stripeSubscriptionItemId: varchar({ length: 255 }),
    grantedByAdminUserId: varchar({ length: 255 }),
    /** Set when source is `team` — workspace that granted the add-on. */
    teamId: integer(),
    startsAt: timestamp().notNull().defaultNow(),
    endsAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_addon_entitlements_user_addon_uidx').on(t.userId, t.addonKey),
    index('user_addon_entitlements_user_id_idx').on(t.userId),
    index('user_addon_entitlements_addon_key_idx').on(t.addonKey),
    index('user_addon_entitlements_team_id_idx').on(t.teamId),
  ],
);

/** AI Essay activities generated by a user (or assigned via a team workspace). */
export const essayDocuments = pgTable(
  'essay_documents',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    teamId: integer(),
    title: varchar({ length: 512 }).notNull(),
    subject: varchar({ length: 255 }).notNull(),
    gradeLevel: varchar({ length: 64 }).notNull(),
    essayType: varchar({ length: 64 }).notNull(),
    difficultyLevel: varchar({ length: 32 }).notNull(),
    topic: varchar({ length: 512 }).notNull(),
    learningStandard: varchar({ length: 512 }).notNull().default(''),
    wordCountTarget: integer().notNull(),
    timeLimitMinutes: integer().notNull().default(0),
    status: varchar({ length: 32 }).notNull().default('ready'),
    input: json().$type<EssayGenerateInput>().notNull(),
    result: json().$type<EssayGenerationResult>().notNull(),
    modelEssayRevealed: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('essay_documents_user_id_idx').on(t.userId),
    index('essay_documents_team_id_idx').on(t.teamId),
  ],
);

/** Per-user writing draft / submission for an essay document. */
export const essayDrafts = pgTable(
  'essay_drafts',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    documentId: integer().notNull(),
    userId: varchar({ length: 255 }).notNull(),
    body: text().notNull().default(''),
    wordCount: integer().notNull().default(0),
    /** Per-section draft text keyed by section id (dynamic essay builder v2). */
    sectionsContent: json().$type<Record<string, string>>().notNull().default({}),
    status: varchar({ length: 32 }).notNull().default('draft'),
    submittedAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('essay_drafts_user_id_idx').on(t.userId),
    index('essay_drafts_document_id_idx').on(t.documentId),
    uniqueIndex('essay_drafts_user_document_uidx').on(t.userId, t.documentId),
  ],
);

/** AI feedback snapshots for submitted (or draft) essays. */
export const essayFeedback = pgTable(
  'essay_feedback',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    documentId: integer().notNull(),
    draftId: integer().notNull(),
    userId: varchar({ length: 255 }).notNull(),
    result: json().$type<EssayFeedbackResult>().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('essay_feedback_user_id_idx').on(t.userId),
    index('essay_feedback_document_id_idx').on(t.documentId),
  ],
);

/** Team-admin assignments of essay activities to members. */
export const essayAssignments = pgTable(
  'essay_assignments',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer().notNull(),
    documentId: integer().notNull(),
    assigneeUserId: varchar({ length: 255 }).notNull(),
    assignedByUserId: varchar({ length: 255 }).notNull(),
    status: varchar({ length: 32 }).notNull().default('assigned'),
    dueAt: timestamp(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('essay_assignments_assignee_idx').on(t.assigneeUserId),
    index('essay_assignments_team_id_idx').on(t.teamId),
    uniqueIndex('essay_assignments_team_doc_assignee_uidx').on(
      t.teamId,
      t.documentId,
      t.assigneeUserId,
    ),
  ],
);

/** Lightweight AI Essay usage / analytics events. */
export const essayUsageEvents = pgTable(
  'essay_usage_events',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    addonKey: varchar({ length: 128 }).notNull().default('ai_essay'),
    eventType: varchar({ length: 64 }).notNull(),
    documentId: integer(),
    draftId: integer(),
    tokensUsed: integer().notNull().default(0),
    metadata: json().$type<Record<string, unknown>>(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('essay_usage_events_user_id_idx').on(t.userId),
    index('essay_usage_events_event_type_idx').on(t.eventType),
    index('essay_usage_events_created_at_idx').on(t.createdAt),
  ],
);

/** AI generation feature keys stored on usage events. */
export const aiUsageFeatureEnum = pgEnum('ai_usage_feature', [
  'flashcards',
  'quiz',
  'lesson_plan',
  'essay',
  'study_guide',
  'passage',
  'ai_recall',
  'homework',
  'worksheet',
  'documentation',
  'tts',
  'ocr',
  'curriculum_research',
  'image_generation',
  'live_classroom',
  'other',
]);

/** Outcome of a tracked AI provider request. */
export const aiUsageStatusEnum = pgEnum('ai_usage_status', [
  'success',
  'failed',
  'blocked',
  'timed_out',
]);

/**
 * Normalized AI usage events — tokens, cost, model, and status.
 * Does not store prompts or generated educational content.
 */
export const aiUsageEvents = pgTable(
  'ai_usage_events',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    teamId: integer().references(() => teams.id, { onDelete: 'set null' }),
    subscriptionPlan: varchar({ length: 64 }),
    feature: aiUsageFeatureEnum().notNull(),
    model: varchar({ length: 128 }).notNull(),
    provider: varchar({ length: 64 }).notNull().default('openai'),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    cachedInputTokens: integer().notNull().default(0),
    totalTokens: integer().notNull().default(0),
    /** Estimated cost in millionths of the currency unit (micros). */
    estimatedCostMicros: integer().notNull().default(0),
    currency: varchar({ length: 8 }).notNull().default('usd'),
    pricingVersion: varchar({ length: 64 }).notNull().default('2026-07-01'),
    status: aiUsageStatusEnum().notNull(),
    responseTimeMs: integer(),
    providerRequestId: varchar({ length: 255 }),
    errorCode: varchar({ length: 128 }),
    errorCategory: varchar({ length: 64 }),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('ai_usage_events_user_created_idx').on(t.userId, t.createdAt),
    index('ai_usage_events_team_created_idx').on(t.teamId, t.createdAt),
    index('ai_usage_events_feature_created_idx').on(t.feature, t.createdAt),
    index('ai_usage_events_model_created_idx').on(t.model, t.createdAt),
    index('ai_usage_events_status_created_idx').on(t.status, t.createdAt),
    index('ai_usage_events_created_at_idx').on(t.createdAt),
  ],
);

/**
 * Per-user period counters for atomic monthly/billing-period limit enforcement.
 * Resets create adjustment rows instead of deleting historical events.
 */
export const aiUsagePeriodCounters = pgTable(
  'ai_usage_period_counters',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    periodStart: timestamp().notNull(),
    periodEnd: timestamp().notNull(),
    /** Successful generations counted toward the allowance in this period. */
    generationCount: integer().notNull().default(0),
    /** Admin reset subtracts this from effective usage without deleting events. */
    resetAdjustment: integer().notNull().default(0),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    totalTokens: integer().notNull().default(0),
    estimatedCostMicros: integer().notNull().default(0),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ai_usage_period_counters_user_period_uidx').on(
      t.userId,
      t.periodStart,
    ),
    index('ai_usage_period_counters_period_idx').on(t.periodStart, t.periodEnd),
  ],
);

/** Optional per-user AI allowance / access overrides. */
export const aiUsageUserLimits = pgTable(
  'ai_usage_user_limits',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull().unique(),
    /** null + unlimited=false means use plan default; unlimited=true means no cap. */
    monthlyAllowance: integer(),
    unlimited: boolean().notNull().default(false),
    aiAccessEnabled: boolean().notNull().default(true),
    warningThreshold80: boolean().notNull().default(true),
    warningThreshold90: boolean().notNull().default(true),
    warningThreshold100: boolean().notNull().default(true),
    blockAtLimit: boolean().notNull().default(true),
    allowOverage: boolean().notNull().default(false),
    flagged: boolean().notNull().default(false),
    flagReason: text(),
    notes: text(),
    updatedAt: timestamp().notNull().defaultNow(),
    updatedByUserId: varchar({ length: 255 }),
  },
  (t) => [index('ai_usage_user_limits_user_id_idx').on(t.userId)],
);

/** Optional per-team AI allowance overrides. */
export const aiUsageTeamLimits = pgTable(
  'ai_usage_team_limits',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' })
      .unique(),
    monthlyAllowance: integer(),
    unlimited: boolean().notNull().default(false),
    aiAccessEnabled: boolean().notNull().default(true),
    blockAtLimit: boolean().notNull().default(true),
    allowOverage: boolean().notNull().default(false),
    updatedAt: timestamp().notNull().defaultNow(),
    updatedByUserId: varchar({ length: 255 }),
  },
  (t) => [index('ai_usage_team_limits_team_id_idx').on(t.teamId)],
);

/** Audit trail for AI usage admin actions (limits, access, resets). */
export const aiUsageAdminAuditLogs = pgTable(
  'ai_usage_admin_audit_logs',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: varchar({ length: 255 }).notNull(),
    actorName: varchar({ length: 255 }).notNull(),
    targetUserId: varchar({ length: 255 }),
    targetTeamId: integer(),
    action: varchar({ length: 64 }).notNull(),
    previousValue: json().$type<Record<string, unknown>>(),
    newValue: json().$type<Record<string, unknown>>(),
    reason: text(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('ai_usage_admin_audit_logs_actor_idx').on(t.actorUserId),
    index('ai_usage_admin_audit_logs_target_user_idx').on(t.targetUserId),
    index('ai_usage_admin_audit_logs_created_at_idx').on(t.createdAt),
  ],
);

/**
 * Completed AI Recall™ session analytics — stored permanently for teacher / team dashboards.
 */
export const aiRecallSessions = pgTable(
  'ai_recall_sessions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    userId: varchar({ length: 255 }).notNull(),
    deckId: integer().references(() => decks.id, { onDelete: 'set null' }),
    deckName: varchar({ length: 255 }).notNull(),
    teamId: integer().references(() => teams.id, { onDelete: 'set null' }),
    cardsReviewed: integer().notNull(),
    correct: integer().notNull(),
    incorrect: integer().notNull(),
    forcedUnlocks: integer().notNull().default(0),
    averageRecallTimeMs: integer().notNull().default(0),
    averageAiScore: integer(),
    masteredCards: integer().notNull().default(0),
    needsReview: integer().notNull().default(0),
    sessionDurationMs: integer().notNull().default(0),
    perCard: json().$type<import('@/lib/ai-recall-types').AiRecallPerCardSnapshot[]>(),
    savedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('ai_recall_sessions_user_id_idx').on(t.userId),
    index('ai_recall_sessions_team_id_idx').on(t.teamId),
    index('ai_recall_sessions_deck_id_idx').on(t.deckId),
  ],
);

/** In-app inbox delivery for completed AI Recall™ sessions. */
export const aiRecallResultInboxMessages = pgTable(
  'ai_recall_result_inbox_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: varchar({ length: 255 }).notNull(),
    sessionId: integer()
      .notNull()
      .references(() => aiRecallSessions.id, { onDelete: 'cascade' }),
    title: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    read: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('ai_recall_result_inbox_recipient_idx').on(t.recipientUserId),
    index('ai_recall_result_inbox_session_idx').on(t.sessionId),
    uniqueIndex('ai_recall_result_inbox_recipient_session_uidx').on(
      t.recipientUserId,
      t.sessionId,
    ),
  ],
);

/* ─── Live Classroom™ (organization add-on) ─────────────────────────────── */

export const liveClassroomSessionStatusEnum = pgEnum(
  'live_classroom_session_status',
  ['scheduled', 'lobby', 'active', 'paused', 'completed', 'cancelled'],
);

export const liveClassroomSessionTypeEnum = pgEnum(
  'live_classroom_session_type',
  ['warm_up', 'team_battle', 'exit_ticket', 'review_battle'],
);

export const liveClassroomBattleModeEnum = pgEnum(
  'live_classroom_battle_mode',
  ['individual_team', 'collaborative_team', 'survival'],
);

export const liveClassroomTeamAssignmentEnum = pgEnum(
  'live_classroom_team_assignment',
  ['manual', 'random', 'saved_groups'],
);

export const liveClassroomCaptainModeEnum = pgEnum(
  'live_classroom_captain_mode',
  ['rotation', 'random', 'fixed'],
);

export const liveClassroomStrategyCardKindEnum = pgEnum(
  'live_classroom_strategy_card_kind',
  [
    'double_points',
    'extra_time',
    'fifty_fifty',
    'shield',
    'ai_hint',
    'score_boost',
    'recovery',
  ],
);

export const liveClassroomStrategyCardPolicyEnum = pgEnum(
  'live_classroom_strategy_card_policy',
  ['unlimited', 'limited', 'disabled'],
);

export const liveClassroomDifficultyEnum = pgEnum(
  'live_classroom_difficulty',
  ['easy', 'medium', 'hard'],
);

export const liveClassroomOrgRoleEnum = pgEnum('live_classroom_org_role', [
  'subscription_owner',
  'team_administrator',
  'teacher',
  'student',
]);

/** Per-team Live Classroom organization settings (defaults + concurrent caps). */
export const liveClassroomTeamSettings = pgTable(
  'live_classroom_team_settings',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    enabled: boolean().notNull().default(true),
    defaultBattleType: liveClassroomSessionTypeEnum().notNull().default('warm_up'),
    allowMusic: boolean().notNull().default(false),
    allowStrategyCards: boolean().notNull().default(true),
    allowAiExplanations: boolean().notNull().default(true),
    defaultTeamAssignment: liveClassroomTeamAssignmentEnum()
      .notNull()
      .default('random'),
    maxConcurrentSessions: integer().notNull().default(1),
    strategyCardPolicy: liveClassroomStrategyCardPolicyEnum()
      .notNull()
      .default('limited'),
    strategyCardLimitPerTeam: integer().notNull().default(2),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [uniqueIndex('live_classroom_team_settings_team_uidx').on(t.teamId)],
);

/** Teacher permission grants beyond owner / team_admin. */
export const liveClassroomTeacherGrants = pgTable(
  'live_classroom_teacher_grants',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: varchar({ length: 255 }).notNull(),
    grantedByUserId: varchar({ length: 255 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('live_classroom_teacher_grants_team_user_uidx').on(
      t.teamId,
      t.userId,
    ),
    index('live_classroom_teacher_grants_user_idx').on(t.userId),
  ],
);

/**
 * Explicit Live Classroom™ roster assignment.
 * Workspace membership alone does not grant access — members must be assigned here.
 */
export const liveClassroomParticipantGrants = pgTable(
  'live_classroom_participant_grants',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: varchar({ length: 255 }).notNull(),
    grantedByUserId: varchar({ length: 255 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('live_classroom_participant_grants_team_user_uidx').on(
      t.teamId,
      t.userId,
    ),
    index('live_classroom_participant_grants_user_idx').on(t.userId),
  ],
);

/** Reusable classroom groups for Saved Groups team assignment. */
export const liveClassroomSavedGroups = pgTable(
  'live_classroom_saved_groups',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: varchar({ length: 255 }).notNull(),
    /** Array of { teamName, userIds[] }. */
    groups: json()
      .$type<Array<{ teamName: string; userIds: string[] }>>()
      .notNull()
      .default([]),
    createdByUserId: varchar({ length: 255 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index('live_classroom_saved_groups_team_idx').on(t.teamId)],
);

export const liveClassroomSessions = pgTable(
  'live_classroom_sessions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    hostUserId: varchar({ length: 255 }).notNull(),
    name: varchar({ length: 255 }).notNull(),
    status: liveClassroomSessionStatusEnum().notNull().default('lobby'),
    sessionType: liveClassroomSessionTypeEnum().notNull().default('warm_up'),
    battleMode: liveClassroomBattleModeEnum()
      .notNull()
      .default('individual_team'),
    deckId: integer().references(() => decks.id, { onDelete: 'set null' }),
    savedGroupId: integer(),
    config: json()
      .$type<import('@/lib/live-classroom-types').LiveClassroomSessionConfig>()
      .notNull(),
    currentQuestionIndex: integer().notNull().default(0),
    questionStartedAt: timestamp(),
    musicMuted: boolean().notNull().default(false),
    teamsLocked: boolean().notNull().default(false),
    scheduledFor: timestamp(),
    startedAt: timestamp(),
    endedAt: timestamp(),
    joinCode: varchar({ length: 16 }).notNull(),
    /** Future-ready: voice, polls, screen share flags without migrations. */
    extensions: json().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('live_classroom_sessions_team_status_idx').on(t.teamId, t.status),
    index('live_classroom_sessions_host_idx').on(t.hostUserId),
    uniqueIndex('live_classroom_sessions_join_code_uidx').on(t.joinCode),
  ],
);

export const liveClassroomTeams = pgTable(
  'live_classroom_teams',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer()
      .notNull()
      .references(() => liveClassroomSessions.id, { onDelete: 'cascade' }),
    name: varchar({ length: 128 }).notNull(),
    colorKey: varchar({ length: 32 }).notNull().default('blue'),
    score: integer().notNull().default(0),
    hearts: integer().notNull().default(3),
    eliminated: boolean().notNull().default(false),
    captainUserId: varchar({ length: 255 }),
    sortOrder: integer().notNull().default(0),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index('live_classroom_teams_session_idx').on(t.sessionId)],
);

export const liveClassroomParticipants = pgTable(
  'live_classroom_participants',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer()
      .notNull()
      .references(() => liveClassroomSessions.id, { onDelete: 'cascade' }),
    userId: varchar({ length: 255 }).notNull(),
    displayName: varchar({ length: 255 }).notNull().default(''),
    liveTeamId: integer().references(() => liveClassroomTeams.id, {
      onDelete: 'set null',
    }),
    connected: boolean().notNull().default(true),
    lastSeenAt: timestamp().notNull().defaultNow(),
    correctCount: integer().notNull().default(0),
    incorrectCount: integer().notNull().default(0),
    totalResponseTimeMs: integer().notNull().default(0),
    answersSubmitted: integer().notNull().default(0),
    removed: boolean().notNull().default(false),
    joinedAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('live_classroom_participants_session_user_uidx').on(
      t.sessionId,
      t.userId,
    ),
    index('live_classroom_participants_user_idx').on(t.userId),
  ],
);

export const liveBattleQuestions = pgTable(
  'live_battle_questions',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer()
      .notNull()
      .references(() => liveClassroomSessions.id, { onDelete: 'cascade' }),
    sortOrder: integer().notNull().default(0),
    prompt: text().notNull(),
    choices: json().$type<string[]>().notNull().default([]),
    correctIndex: integer().notNull().default(0),
    explanation: text().notNull().default(''),
    distractorExplanations: json().$type<string[]>().notNull().default([]),
    topic: varchar({ length: 255 }).notNull().default(''),
    cardId: integer().references(() => cards.id, { onDelete: 'set null' }),
    media: json()
      .$type<{
        kind: 'none' | 'image' | 'drawing' | 'math_whiteboard' | 'video';
        url?: string;
      }>()
      .notNull()
      .default({ kind: 'none' }),
    revealed: boolean().notNull().default(false),
    aiExplanationShown: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('live_battle_questions_session_idx').on(t.sessionId),
    uniqueIndex('live_battle_questions_session_order_uidx').on(
      t.sessionId,
      t.sortOrder,
    ),
  ],
);

export const liveBattleAnswers = pgTable(
  'live_battle_answers',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer()
      .notNull()
      .references(() => liveClassroomSessions.id, { onDelete: 'cascade' }),
    questionId: integer()
      .notNull()
      .references(() => liveBattleQuestions.id, { onDelete: 'cascade' }),
    userId: varchar({ length: 255 }).notNull(),
    liveTeamId: integer().references(() => liveClassroomTeams.id, {
      onDelete: 'set null',
    }),
    choiceIndex: integer().notNull(),
    correct: boolean().notNull().default(false),
    pointsAwarded: integer().notNull().default(0),
    speedBonus: integer().notNull().default(0),
    responseTimeMs: integer().notNull().default(0),
    submittedAsCaptain: boolean().notNull().default(false),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('live_battle_answers_question_user_uidx').on(
      t.questionId,
      t.userId,
    ),
    index('live_battle_answers_session_idx').on(t.sessionId),
  ],
);

export const liveBattleStrategyCards = pgTable(
  'live_battle_strategy_cards',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer()
      .notNull()
      .references(() => liveClassroomSessions.id, { onDelete: 'cascade' }),
    liveTeamId: integer()
      .notNull()
      .references(() => liveClassroomTeams.id, { onDelete: 'cascade' }),
    kind: liveClassroomStrategyCardKindEnum().notNull(),
    usedByUserId: varchar({ length: 255 }),
    questionId: integer().references(() => liveBattleQuestions.id, {
      onDelete: 'set null',
    }),
    usedAt: timestamp(),
    /** 50/50 result — the two wrong-choice indexes hidden for the using team on that question. */
    eliminatedChoices: integer().array(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [index('live_battle_strategy_cards_session_idx').on(t.sessionId)],
);

export const liveBattleReports = pgTable(
  'live_battle_reports',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sessionId: integer()
      .notNull()
      .references(() => liveClassroomSessions.id, { onDelete: 'cascade' }),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    hostUserId: varchar({ length: 255 }).notNull(),
    sessionName: varchar({ length: 255 }).notNull(),
    stats: json()
      .$type<import('@/lib/live-classroom-types').LiveClassroomReportStats>()
      .notNull(),
    winnerTeamName: varchar({ length: 128 }),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('live_battle_reports_session_uidx').on(t.sessionId),
    index('live_battle_reports_team_idx').on(t.teamId),
    index('live_battle_reports_host_idx').on(t.hostUserId),
  ],
);

export const liveTeacherAnalytics = pgTable(
  'live_teacher_analytics',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    teacherUserId: varchar({ length: 255 }).notNull(),
    sessionsHosted: integer().notNull().default(0),
    totalAttendance: integer().notNull().default(0),
    averageAccuracyPercent: integer().notNull().default(0),
    battleWins: integer().notNull().default(0),
    strategyCardsUsed: integer().notNull().default(0),
    lastSessionAt: timestamp(),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('live_teacher_analytics_team_teacher_uidx').on(
      t.teamId,
      t.teacherUserId,
    ),
  ],
);

export const liveOrganizationAnalytics = pgTable(
  'live_organization_analytics',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    totalSessions: integer().notNull().default(0),
    totalAttendance: integer().notNull().default(0),
    averageAttendance: integer().notNull().default(0),
    averageAccuracyPercent: integer().notNull().default(0),
    averageResponseTimeSec: integer().notNull().default(0),
    mostActiveTeacherUserId: varchar({ length: 255 }),
    strategyCardsUsed: integer().notNull().default(0),
    updatedAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('live_organization_analytics_team_uidx').on(t.teamId),
  ],
);

/** Formal in-app lobby invite with join code for assigned Live Classroom™ members. */
export const liveClassroomLobbyInboxMessages = pgTable(
  'live_classroom_lobby_inbox_messages',
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    recipientUserId: varchar({ length: 255 }).notNull(),
    teamId: integer()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    sessionId: integer()
      .notNull()
      .references(() => liveClassroomSessions.id, { onDelete: 'cascade' }),
    title: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    joinCode: varchar({ length: 16 }).notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (t) => [
    index('live_classroom_lobby_inbox_recipient_idx').on(t.recipientUserId),
    index('live_classroom_lobby_inbox_session_idx').on(t.sessionId),
    uniqueIndex('live_classroom_lobby_inbox_recipient_session_uidx').on(
      t.recipientUserId,
      t.sessionId,
    ),
  ],
);

/** Row shapes for client `import type` — avoids bundling table refs into client runtime chunks. */
export type TeamInvitationRow = InferSelectModel<typeof teamInvitations>;
export type TeamMemberRow = InferSelectModel<typeof teamMembers>;
export type DeckRow = InferSelectModel<typeof decks>;
export type TeamDeckAssignmentRow = InferSelectModel<typeof teamDeckAssignments>;
export type PlanReconciliationSession = InferSelectModel<typeof planReconciliationSessions>;
export type TeacherClassRow = InferSelectModel<typeof teacherClasses>;
export type AiRecallSessionRow = InferSelectModel<typeof aiRecallSessions>;
export type AiRecallResultInboxMessageRow = InferSelectModel<
  typeof aiRecallResultInboxMessages
>;
export type CardMasteryRow = InferSelectModel<typeof cardMastery>;
export type AddonCatalogRow = InferSelectModel<typeof addonCatalog>;
export type AddonCatalogSettingsRow = InferSelectModel<typeof addonCatalogSettings>;
export type UserAddonEntitlementRow = InferSelectModel<typeof userAddonEntitlements>;
export type EssayDocumentRow = InferSelectModel<typeof essayDocuments>;
export type EssayDraftRow = InferSelectModel<typeof essayDrafts>;
export type EssayFeedbackRow = InferSelectModel<typeof essayFeedback>;
export type EssayAssignmentRow = InferSelectModel<typeof essayAssignments>;
export type EssayUsageEventRow = InferSelectModel<typeof essayUsageEvents>;
export type AiUsageEventRow = InferSelectModel<typeof aiUsageEvents>;
export type AiUsagePeriodCounterRow = InferSelectModel<typeof aiUsagePeriodCounters>;
export type AiUsageUserLimitRow = InferSelectModel<typeof aiUsageUserLimits>;
export type AiUsageTeamLimitRow = InferSelectModel<typeof aiUsageTeamLimits>;
export type AiUsageAdminAuditLogRow = InferSelectModel<typeof aiUsageAdminAuditLogs>;
export type LiveClassroomTeamSettingsRow = InferSelectModel<
  typeof liveClassroomTeamSettings
>;
export type LiveClassroomTeacherGrantRow = InferSelectModel<
  typeof liveClassroomTeacherGrants
>;
export type LiveClassroomParticipantGrantRow = InferSelectModel<
  typeof liveClassroomParticipantGrants
>;
export type LiveClassroomSavedGroupRow = InferSelectModel<
  typeof liveClassroomSavedGroups
>;
export type LiveClassroomSessionRow = InferSelectModel<typeof liveClassroomSessions>;
export type LiveClassroomTeamRow = InferSelectModel<typeof liveClassroomTeams>;
export type LiveClassroomParticipantRow = InferSelectModel<
  typeof liveClassroomParticipants
>;
export type LiveBattleQuestionRow = InferSelectModel<typeof liveBattleQuestions>;
export type LiveBattleAnswerRow = InferSelectModel<typeof liveBattleAnswers>;
export type LiveBattleStrategyCardRow = InferSelectModel<
  typeof liveBattleStrategyCards
>;
export type LiveBattleReportRow = InferSelectModel<typeof liveBattleReports>;
export type LiveTeacherAnalyticsRow = InferSelectModel<typeof liveTeacherAnalytics>;
export type LiveOrganizationAnalyticsRow = InferSelectModel<
  typeof liveOrganizationAnalytics
>;
export type LiveClassroomLobbyInboxMessageRow = InferSelectModel<
  typeof liveClassroomLobbyInboxMessages
>;
