import type { SavedHomeworkRow } from "@/db/queries/saved-homework";
import type { HomeworkResult } from "@/lib/teacher-homework-ai-schema";

export function buildHomeworkStudyGuideContext(homework: SavedHomeworkRow): string {
  const result = homework.result as HomeworkResult;
  const lines = [
    `Assignment title: ${homework.assignmentTitle}`,
    `Saved label: ${homework.label}`,
    `Subject: ${homework.subject}`,
    `Grade level: ${homework.gradeLevel}`,
    `Topic: ${homework.topic}`,
    `Difficulty: ${homework.difficultyLevel}`,
    "",
    "Student instructions:",
    result.instructions,
    "",
    "Homework questions:",
    ...result.questions.map((item) => `- ${item}`),
    "",
    "Answer key (use to align the study guide — do not copy answers verbatim into student-facing practice questions):",
    ...result.answerKey.map((item) => `- ${item}`),
  ];

  return lines.join("\n");
}
