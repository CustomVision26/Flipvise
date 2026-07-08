import type { cards } from "@/db/schema";
import type { DeckRow } from "@/db/queries/decks";
import { deckToHomeworkDefaults } from "@/lib/homework-source-context";
import type { DeckWorksheetResult, WorksheetItem } from "@/lib/teacher-worksheet-schema";

type CardRow = typeof cards.$inferSelect;

function normalizeImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

function resolveCardAnswer(card: CardRow): {
  answer: string;
  answerImageUrl: string | null;
  backImageUrl: string | null;
} {
  if (card.cardType === "multiple_choice" && card.choices?.length) {
    const correctIdx = card.correctChoiceIndex ?? 0;
    const correct = card.choices[correctIdx]?.trim() ?? "";
    const choiceImages = card.choiceImageUrls ?? [];
    const answerImageUrl = normalizeImageUrl(choiceImages[correctIdx]);
    return {
      answer: correct || card.back?.trim() || "(see image)",
      answerImageUrl,
      backImageUrl: normalizeImageUrl(card.backImageUrl) ?? answerImageUrl,
    };
  }

  return {
    answer: card.back?.trim() || "(see image)",
    answerImageUrl: normalizeImageUrl(card.backImageUrl),
    backImageUrl: normalizeImageUrl(card.backImageUrl),
  };
}

export function buildWorksheetItemsFromCards(cardRows: CardRow[]): WorksheetItem[] {
  return cardRows.map((card, index) => {
    const { answer, answerImageUrl, backImageUrl } = resolveCardAnswer(card);
    const frontImageUrl = normalizeImageUrl(card.frontImageUrl);

    return {
      questionNumber: index + 1,
      prompt: card.front?.trim() || (frontImageUrl ? "Refer to the image." : "Complete this item."),
      promptImageUrl: frontImageUrl,
      answer,
      answerImageUrl,
      frontImageUrl,
      backImageUrl,
    };
  });
}

export function buildDeckWorksheetResult(
  deck: DeckRow,
  cardRows: CardRow[],
  input: {
    subject: string;
    gradeLevel: string;
    topic: string;
    worksheetType: string;
    difficultyLevel: string;
  },
): DeckWorksheetResult {
  const items = buildWorksheetItemsFromCards(cardRows);
  const defaults = deckToHomeworkDefaults(deck);
  const subject = input.subject.trim() || defaults.subject;
  const topic = input.topic.trim() || defaults.topic;
  const gradeLevel = input.gradeLevel.trim() || defaults.gradeLevel;
  const worksheetType = input.worksheetType.trim() || "Practice";
  const difficultyLevel = input.difficultyLevel.trim() || defaults.difficultyLevel;

  return {
    worksheetTitle: `${topic} — ${worksheetType} Worksheet`,
    deckName: deck.name,
    subject,
    gradeLevel,
    topic,
    worksheetType,
    difficultyLevel,
    instructions: `Complete this ${worksheetType.toLowerCase()} worksheet on ${topic}. Use the questions below. Write your answers in the space provided.`,
    studentHeader: `Name: ____________________    Date: ____________________\n\n${topic} — ${worksheetType} (${difficultyLevel})`,
    items,
  };
}
