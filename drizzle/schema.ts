import { pgTable, integer, varchar, timestamp, unique, text, foreignKey, boolean, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const adminPrivilegeAction = pgEnum("admin_privilege_action", ['granted', 'revoked'])


export const adminPrivilegeLogs = pgTable("admin_privilege_logs", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "admin_privilege_logs_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	targetUserId: varchar({ length: 255 }).notNull(),
	targetUserName: varchar({ length: 255 }).notNull(),
	grantedByUserId: varchar({ length: 255 }).notNull(),
	grantedByName: varchar({ length: 255 }).notNull(),
	action: adminPrivilegeAction().notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const deactivated = pgTable("deactivated", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "deactivated_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	userId: varchar({ length: 255 }).notNull(),
	userName: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }),
	deactivatedByUserId: varchar({ length: 255 }).notNull(),
	deactivatedByName: varchar({ length: 255 }).notNull(),
	reason: text(),
	deactivatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("deactivated_userId_unique").on(table.userId),
]);

export const decks = pgTable("decks", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "decks_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	userId: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
});

export const cards = pgTable("cards", {
	id: integer().primaryKey().generatedAlwaysAsIdentity({ name: "cards_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 2147483647, cache: 1 }),
	deckId: integer().notNull(),
	front: text(),
	frontImageUrl: text(),
	back: text(),
	backImageUrl: text(),
	aiGenerated: boolean().default(false).notNull(),
	createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.deckId],
			foreignColumns: [decks.id],
			name: "cards_deckId_decks_id_fk"
		}).onDelete("cascade"),
]);
