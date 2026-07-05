import type { DeckRow, cards } from "@/db/schema";
import { parseDeckSubjectTopic } from "@/lib/deck-subject-topic";

type CardRow = typeof cards.$inferSelect;

/** Representative deck card sample size for homework AI context. */
export const HOMEWORK_DECK_CARD_SAMPLE_SIZE = 24;

export function sampleDeckCardsForHomework<T>(cards: T[], sampleSize = HOMEWORK_DECK_CARD_SAMPLE_SIZE): T[] {
  if (cards.length <= sampleSize) {
    return cards;
  }

  const sampled: T[] = [];
  const step = cards.length / sampleSize;
  for (let i = 0; i < sampleSize; i++) {
    const index = Math.min(cards.length - 1, Math.floor(i * step));
    sampled.push(cards[index]!);
  }
  return sampled;
}

function formatCardForHomeworkContext(card: CardRow): string {
  const front = card.front?.trim() || "(image prompt)";
  if (card.cardType === "multiple_choice" && card.choices?.length) {
    const correctIdx = card.correctChoiceIndex ?? 0;
    const correct = card.choices[correctIdx] ?? card.back ?? "";
    const wrong = card.choices.filter((_, i) => i !== correctIdx).join(" | ");
    return `- MC: ${front} → Correct: ${correct}${wrong ? ` | Distractors: ${wrong}` : ""}`;
  }
  const back = card.back?.trim() || "(image answer)";
  return `- ${front} → ${back}`;
}

export function buildDeckHomeworkContext(deck: DeckRow, cardRows: CardRow[]): string {
  const { subject, topic } = parseDeckSubjectTopic(deck);
  const lines = [`Deck name: ${deck.name}`];

  if (subject) {
    lines.push(`Subject: ${subject}`);
  }
  if (topic) {
    lines.push(`Topic: ${topic}`);
  }
  if (deck.description?.trim()) {
    lines.push(`Deck description: ${deck.description.trim()}`);
  }
  if (deck.gradeLevel?.trim()) {
    lines.push(`Deck grade level: ${deck.gradeLevel.trim()}`);
  }
  if (deck.difficultyLevel?.trim()) {
    lines.push(`Deck difficulty: ${deck.difficultyLevel.trim()}`);
  }

  lines.push("", "Sample flashcards from this deck (primary source — use these as models):");
  const sample = sampleDeckCardsForHomework(cardRows);
  if (sample.length === 0) {
    lines.push("(No cards in deck.)");
  } else {
    lines.push(
      `(Deck has ${cardRows.length} card${cardRows.length === 1 ? "" : "s"}; showing ${sample.length} representative sample${sample.length === 1 ? "" : "s"}.)`,
    );
    for (const card of sample) {
      lines.push(formatCardForHomeworkContext(card));
    }
    if (cardRows.length > sample.length) {
      lines.push(
        `Draw from concepts across the full deck, not only these ${sample.length} sample cards.`,
      );
    }
  }

  return lines.join("\n");
}

export function deckToHomeworkDefaults(deck: DeckRow): {
  subject: string;
  topic: string;
  gradeLevel: string;
  difficultyLevel: string;
} {
  const { subject, topic } = parseDeckSubjectTopic(deck);
  return {
    subject,
    topic,
    gradeLevel: deck.gradeLevel?.trim() || "",
    difficultyLevel: deck.difficultyLevel?.trim() || "On-level",
  };
}
