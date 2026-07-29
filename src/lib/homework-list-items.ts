import type {
  HomeworkPassage,
  HomeworkResult,
} from "@/lib/teacher-homework-ai-schema";
import { normalizeHomeworkAnswerGraphs } from "@/lib/homework-answer-graph";

/** Removes leading ordered-list markers (e.g. `1.`, `2)`, `-`) from list item text. */
const ORDERED_LIST_PREFIX = /^\s*(?:\d+[\.\):]|[-•*])\s+/;

export function stripOrderedListPrefix(text: string): string {
  let result = text.trim();
  while (ORDERED_LIST_PREFIX.test(result)) {
    result = result.replace(ORDERED_LIST_PREFIX, "").trim();
  }
  return result;
}

export function normalizeHomeworkListItems(items: string[]): string[] {
  return items.map(stripOrderedListPrefix).filter((item) => item.length > 0);
}

export type HomeworkPassageSection = {
  title?: string;
  body: string;
  questions: string[];
  answerKey: string[];
  /** 1-based global question numbers for display. */
  questionNumbers: number[];
};

/**
 * Builds display sections: each passage with its linked questions.
 * Falls back to a single legacy passage or questions-only when no passages array.
 */
export function getHomeworkPassageSections(
  result: HomeworkResult,
): HomeworkPassageSection[] {
  const questions = result.questions;
  const answerKey = result.answerKey;

  const passages = normalizePassagesList(result);
  if (passages.length === 0) {
    return [
      {
        body: "",
        questions,
        answerKey,
        questionNumbers: questions.map((_, index) => index + 1),
      },
    ];
  }

  const counts = resolvePassageQuestionCounts(result, passages.length, questions.length);
  const sections: HomeworkPassageSection[] = [];
  let offset = 0;
  for (let index = 0; index < passages.length; index++) {
    const count = counts[index] ?? 0;
    const sliceQuestions = questions.slice(offset, offset + count);
    const sliceAnswers = answerKey.slice(offset, offset + count);
    const questionNumbers = sliceQuestions.map((_, i) => offset + i + 1);
    sections.push({
      title: passages[index]!.title,
      body: passages[index]!.body,
      questions: sliceQuestions,
      answerKey: sliceAnswers,
      questionNumbers,
    });
    offset += count;
  }

  if (offset < questions.length) {
    sections.push({
      body: "",
      questions: questions.slice(offset),
      answerKey: answerKey.slice(offset),
      questionNumbers: questions.slice(offset).map((_, i) => offset + i + 1),
    });
  }

  return sections;
}

/** Accepts AI/schema results and looser template fallbacks (`undefined` optional fields). */
export type HomeworkResultInput = {
  assignmentTitle: string;
  instructions: string;
  passages?: HomeworkPassage[] | null;
  passageQuestionCounts?: number[] | null;
  passageTitle?: string | null;
  passage?: string | null;
  questions: string[];
  answerKey: string[];
  answerGraphs?: HomeworkResult["answerGraphs"];
};

function normalizePassagesList(result: HomeworkResultInput): Array<{
  title?: string;
  body: string;
}> {
  if (result.passages?.length) {
    return result.passages
      .map((passage) => ({
        title: passage.title?.trim() || undefined,
        body: passage.body.trim(),
      }))
      .filter((passage) => passage.body.length > 0);
  }

  const legacy = result.passage?.trim();
  if (!legacy) return [];
  return [
    {
      title: result.passageTitle?.trim() || undefined,
      body: legacy,
    },
  ];
}

function resolvePassageQuestionCounts(
  result: HomeworkResultInput,
  passageCount: number,
  questionCount: number,
): number[] {
  const raw = result.passageQuestionCounts;
  if (raw?.length === passageCount) {
    const sum = raw.reduce((total, count) => total + count, 0);
    if (sum === questionCount) return raw;
  }

  if (passageCount === 1) return [questionCount];

  const base = Math.floor(questionCount / passageCount);
  const remainder = questionCount % passageCount;
  return Array.from({ length: passageCount }, (_, index) =>
    base + (index < remainder ? 1 : 0),
  );
}

export function normalizeHomeworkResult(result: HomeworkResultInput): HomeworkResult {
  const questions = normalizeHomeworkListItems(result.questions);
  const answerKey = normalizeHomeworkListItems(result.answerKey);

  let passages: HomeworkPassage[] | undefined;
  let passageQuestionCounts: number[] | undefined;

  if (result.passages?.length) {
    passages = result.passages
      .map((passage) => {
        const body = passage.body.trim();
        if (!body) return null;
        const title = passage.title?.trim() || null;
        return {
          body,
          title,
        } satisfies HomeworkPassage;
      })
      .filter((passage): passage is HomeworkPassage => passage != null);

    if (passages.length > 0) {
      const counts =
        result.passageQuestionCounts?.length === passages.length
          ? result.passageQuestionCounts
          : resolvePassageQuestionCounts(
              { ...result, questions, answerKey, passages },
              passages.length,
              questions.length,
            );
      passageQuestionCounts = counts;
    } else {
      passages = undefined;
    }
  } else if (result.passage?.trim()) {
    const body = result.passage.trim();
    const title = result.passageTitle?.trim() || null;
    passages = [{ body, title }];
    passageQuestionCounts = [questions.length];
  }

  const first = passages?.[0];

  return {
    assignmentTitle: result.assignmentTitle.trim(),
    instructions: result.instructions.trim(),
    passages: passages?.length ? passages : null,
    passageQuestionCounts: passageQuestionCounts?.length
      ? passageQuestionCounts
      : null,
    passageTitle: first?.title?.trim() || null,
    passage: first?.body ?? null,
    questions,
    answerKey,
    answerGraphs: normalizeHomeworkAnswerGraphs(result.answerGraphs, answerKey.length),
  };
}
