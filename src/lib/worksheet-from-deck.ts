import type { cards } from "@/db/schema";
import type { DeckRow } from "@/db/queries/decks";
import { deckToHomeworkDefaults } from "@/lib/homework-source-context";
import type { LessonPlanReferenceMaterial } from "@/lib/lesson-plan-reference-material";
import type { DeckWorksheetResult, WorksheetItem } from "@/lib/teacher-worksheet-schema";
import {
  buildGenerationTitleSourceSuffix,
  parseLessonScopeLabelFromDeckName,
  parseLessonScopeLabelFromDescription,
  shortenTeacherTitleSegment,
  withTitleSourceSuffix,
} from "@/lib/teacher-generation-titles";

type CardRow = typeof cards.$inferSelect;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeImageUrl(url: unknown): string | null {
  const trimmed = asText(url);
  return trimmed ? trimmed : null;
}

function resolveCardAnswer(card: CardRow): {
  answer: string;
  answerImageUrl: string | null;
  backImageUrl: string | null;
} {
  const choices = Array.isArray(card.choices) ? card.choices : [];
  if (card.cardType === "multiple_choice" && choices.length > 0) {
    const correctIdx = card.correctChoiceIndex ?? 0;
    const correct = asText(choices[correctIdx]);
    const choiceImages = Array.isArray(card.choiceImageUrls) ? card.choiceImageUrls : [];
    const answerImageUrl = normalizeImageUrl(choiceImages[correctIdx]);
    return {
      answer: correct || asText(card.back) || "(see image)",
      answerImageUrl,
      backImageUrl: normalizeImageUrl(card.backImageUrl) ?? answerImageUrl,
    };
  }

  return {
    answer: asText(card.back) || "(see image)",
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
      prompt: asText(card.front) || (frontImageUrl ? "Refer to the image." : "Complete this item."),
      promptImageUrl: frontImageUrl,
      answer,
      answerImageUrl,
      frontImageUrl,
      backImageUrl,
    };
  });
}

export function renumberWorksheetItems(items: WorksheetItem[]): WorksheetItem[] {
  return items.map((item, index) => ({
    ...item,
    questionNumber: index + 1,
  }));
}

function buildWorksheetReferenceInstructions(
  references: LessonPlanReferenceMaterial[],
): string {
  if (references.length === 0) return "";

  const labels = references
    .map((reference) => reference.summary.trim())
    .filter(Boolean)
    .join(", ");

  return labels
    ? ` This worksheet is aligned with lesson reference materials: ${labels}.`
    : " This worksheet is aligned with reference materials from the linked lesson plan.";
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
  options?: {
    referenceMaterials?: LessonPlanReferenceMaterial[];
    /** When set, used instead of mapping every card 1:1. */
    items?: WorksheetItem[];
  },
): DeckWorksheetResult {
  const items = renumberWorksheetItems(
    options?.items ?? buildWorksheetItemsFromCards(cardRows),
  );
  const defaults = deckToHomeworkDefaults(deck);
  const subject = input.subject.trim() || defaults.subject;
  const topic = input.topic.trim() || defaults.topic;
  const gradeLevel = input.gradeLevel.trim() || defaults.gradeLevel;
  const worksheetType = input.worksheetType.trim() || "Practice";
  const difficultyLevel = input.difficultyLevel.trim() || defaults.difficultyLevel;
  const referenceNote = buildWorksheetReferenceInstructions(
    options?.referenceMaterials ?? [],
  );
  const shortTopic = shortenTeacherTitleSegment(topic, 48);
  const deckLessonScopeLabel =
    parseLessonScopeLabelFromDescription(deck.description) ??
    parseLessonScopeLabelFromDeckName(deck.name);
  const titleSuffix = buildGenerationTitleSourceSuffix({
    sourceType: "deck",
    deckName: deck.name,
    deckLessonScopeLabel,
  });

  return {
    worksheetTitle: withTitleSourceSuffix(
      `${shortTopic} — ${worksheetType} Worksheet`,
      titleSuffix,
    ),
    deckName: deck.name,
    subject,
    gradeLevel,
    topic,
    worksheetType,
    difficultyLevel,
    instructions: `Complete this ${worksheetType.toLowerCase()} worksheet on ${shortTopic || topic}. Use the questions below. Write your answers in the space provided.${referenceNote}`,
    studentHeader: `Name: ____________________    Date: ____________________\n\n${shortTopic || topic} — ${worksheetType} (${difficultyLevel})`,
    items,
  };
}
