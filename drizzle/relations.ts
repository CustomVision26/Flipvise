import { relations } from "drizzle-orm/relations";
import { decks, cards } from "./schema";

export const cardsRelations = relations(cards, ({one}) => ({
	deck: one(decks, {
		fields: [cards.deckId],
		references: [decks.id]
	}),
}));

export const decksRelations = relations(decks, ({many}) => ({
	cards: many(cards),
}));