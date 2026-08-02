import "server-only";

import { openai } from "@ai-sdk/openai";
import { Output } from "ai";
import { z } from "zod";
import {
  runWithAiUsageContext,
  trackedGenerateText,
} from "@/lib/ai-usage/track";
import type { LiveClassroomDifficulty } from "@/lib/live-classroom-types";

const warmUpQuestionSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      choices: z.array(z.string()).min(2).max(6),
      correctIndex: z.number().int().min(0),
      explanation: z.string(),
      distractorExplanations: z.array(z.string()),
      topic: z.string(),
    }),
  ),
});

const sessionSummarySchema = z.object({
  summary: z.string(),
  recommendations: z.array(z.string()),
  strongestTopic: z.string().nullable(),
  weakestTopic: z.string().nullable(),
  suggestedReviewMinutes: z.number().int().min(1).max(60),
});

export type GeneratedWarmUpQuestion = z.infer<
  typeof warmUpQuestionSchema
>["questions"][number];

export async function generateLiveClassroomWarmUpQuestions(input: {
  userId: string;
  teamId: number;
  subject: string;
  topic: string;
  grade: string;
  difficulty: LiveClassroomDifficulty;
  questionCount: number;
}): Promise<GeneratedWarmUpQuestion[]> {
  const count = Math.min(20, Math.max(1, input.questionCount));
  return runWithAiUsageContext(
    {
      userId: input.userId,
      teamId: input.teamId,
      feature: "live_classroom",
      model: "gpt-4o",
    },
    async () => {
      const { output } = await trackedGenerateText({
        model: openai("gpt-4o"),
        output: Output.object({ schema: warmUpQuestionSchema }),
        prompt: `Generate ${count} multiple-choice warm-up battle questions for a live classroom.

Subject: ${input.subject}
Topic: ${input.topic}
Grade: ${input.grade}
Difficulty: ${input.difficulty}

Rules:
- Exactly ${count} questions
- Each question has 4 choices
- correctIndex is 0-based
- Provide a clear explanation of the correct answer
- Provide brief distractorExplanations for each incorrect choice (same length as choices; empty string for the correct choice index)
- Keep prompts classroom-appropriate and concise
- Topic field should be a short concept label`,
      });
      if (!output?.questions?.length) {
        throw new Error("AI warm-up generation returned no questions.");
      }
      return output.questions.slice(0, count).map((q) => ({
        ...q,
        choices: q.choices.slice(0, 6),
        correctIndex: Math.min(
          Math.max(0, q.correctIndex),
          Math.max(0, q.choices.length - 1),
        ),
      }));
    },
  );
}

export async function generateLiveClassroomAiExplanation(input: {
  userId: string;
  teamId: number;
  prompt: string;
  choices: string[];
  correctIndex: number;
}): Promise<{
  correctExplanation: string;
  distractorExplanations: string[];
  keyConcept: string;
}> {
  const schema = z.object({
    correctExplanation: z.string(),
    distractorExplanations: z.array(z.string()),
    keyConcept: z.string(),
  });

  return runWithAiUsageContext(
    {
      userId: input.userId,
      teamId: input.teamId,
      feature: "live_classroom",
      model: "gpt-4o",
    },
    async () => {
      const { output } = await trackedGenerateText({
        model: openai("gpt-4o"),
        output: Output.object({ schema }),
        prompt: `Explain a live classroom quiz question for students.

Question: ${input.prompt}
Choices: ${input.choices.map((c, i) => `${i}. ${c}`).join(" | ")}
Correct index: ${input.correctIndex}

Return:
- correctExplanation: why the correct answer is right
- distractorExplanations: one short reason per choice (empty string for the correct choice)
- keyConcept: one short concept label`,
      });
      if (!output) throw new Error("AI explanation failed.");
      return output;
    },
  );
}

export async function generateLiveClassroomTeacherSummary(input: {
  userId: string;
  teamId: number;
  sessionName: string;
  accuracyPercent: number;
  attendance: number;
  strongestTopic: string | null;
  weakestTopic: string | null;
  mostMissedQuestion: string | null;
}): Promise<z.infer<typeof sessionSummarySchema>> {
  return runWithAiUsageContext(
    {
      userId: input.userId,
      teamId: input.teamId,
      feature: "live_classroom",
      model: "gpt-4o",
    },
    async () => {
      const { output } = await trackedGenerateText({
        model: openai("gpt-4o"),
        output: Output.object({ schema: sessionSummarySchema }),
        prompt: `Write a concise AI teacher summary for a Live Classroom session.

Session: ${input.sessionName}
Attendance: ${input.attendance}
Accuracy: ${input.accuracyPercent}%
Strongest topic: ${input.strongestTopic ?? "n/a"}
Weakest topic: ${input.weakestTopic ?? "n/a"}
Most missed question: ${input.mostMissedQuestion ?? "n/a"}

Tone: professional, encouraging, actionable. 2-4 sentences in summary.
Include 2-4 concrete recommendations and a suggestedReviewMinutes between 5 and 20.`,
      });
      if (!output) throw new Error("AI teacher summary failed.");
      return output;
    },
  );
}

/** Build MCQ snapshots from deck cards when AI warm-up is not used. */
export function questionsFromDeckCards(
  cards: Array<{
    id: number;
    front: string;
    back: string;
    distractors?: string[] | null;
  }>,
  questionCount: number,
): Array<{
  prompt: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
  distractorExplanations: string[];
  topic: string;
  cardId: number;
}> {
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, Math.max(1, questionCount));
  const allBacks = cards.map((c) => c.back).filter(Boolean);

  return selected.map((card) => {
    const distractors = (card.distractors ?? [])
      .filter((d) => d && d !== card.back)
      .slice(0, 3);
    while (distractors.length < 3) {
      const pool = allBacks.filter(
        (b) => b !== card.back && !distractors.includes(b),
      );
      if (pool.length === 0) break;
      distractors.push(pool[Math.floor(Math.random() * pool.length)]!);
    }
    const choices = [card.back, ...distractors].slice(0, 4);
    // Shuffle choices
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j]!, choices[i]!];
    }
    const correctIndex = choices.indexOf(card.back);
    return {
      prompt: card.front,
      choices,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      explanation: `The correct answer is: ${card.back}`,
      distractorExplanations: choices.map((c) =>
        c === card.back ? "" : "This is not the matching answer from the deck.",
      ),
      topic: "Deck review",
      cardId: card.id,
    };
  });
}
