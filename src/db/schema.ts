import {
  boolean,
  integer,
  pgTable,
  varchar,
  text,
  timestamp,
  pgEnum,
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

export const decks = pgTable('decks', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: varchar({ length: 255 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  description: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp().notNull().defaultNow(),
});

export const adminPrivilegeActionEnum = pgEnum('admin_privilege_action', ['granted', 'revoked']);

export const adminPrivilegeLogs = pgTable('admin_privilege_logs', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  targetUserId: varchar({ length: 255 }).notNull(),
  targetUserName: varchar({ length: 255 }).notNull(),
  grantedByUserId: varchar({ length: 255 }).notNull(),
  grantedByName: varchar({ length: 255 }).notNull(),
  action: adminPrivilegeActionEnum().notNull(),
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
