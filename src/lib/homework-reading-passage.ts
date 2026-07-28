/**
 * Prompt rules so reading / ELA homework includes the student-facing passage(s)
 * that comprehension questions link to (same spirit as quiz reading passages).
 */

export function buildEnglishHomeworkPassageRules(
  gradeLevel: string,
  numberOfPassages: number,
  questionsPerPassage: number,
): string {
  const multi = numberOfPassages > 1;
  return `READING / LANGUAGE ARTS PASSAGE${multi ? "S" : ""} (required):
- Set passages to an array of objects with title (string or null) and body (required text).
- Each passage needs a short unique title string (e.g. "The Mango Tree") — never reuse the assignment title; do not leave title null for literature passages.
- Each passage body: about 3 short paragraphs / 8–14 sentences with realistic characters, a clear problem or moment, and a clear message appropriate for ${gradeLevel}.
- Set \`passageQuestionCounts\` to [${Array.from({ length: numberOfPassages }, () => questionsPerPassage).join(", ")}] — exactly ${questionsPerPassage} questions per passage.
- Flatten all questions into \`questions\` and matching \`answerKey\` in passage order (passage 1's questions first, then passage 2, …). Total length must be ${numberOfPassages * questionsPerPassage}.
- Naturally weave lesson vocabulary and skills (main idea, inference, character, theme, context clues, cause and effect) into each story — do NOT paste glossary definitions into the passage.
- Every question must be answerable from its linked passage alone.
- Also set legacy \`passage\` / \`passageTitle\` to the first passage for compatibility.
- Do not narrate a class period or lesson-plan activities; write student reading texts.`;
}

export function buildGeneralHomeworkPassageRules(
  gradeLevel: string,
  numberOfPassages: number,
  questionsPerPassage: number,
): string {
  const multi = numberOfPassages > 1;
  return `READING PASSAGE${multi ? "S" : ""} (required for this assignment):
- Populate \`passages\` with exactly ${numberOfPassages} distinct reading passage${multi ? "s" : ""} appropriate for ${gradeLevel} (about 2–3 short paragraphs each).
- Give each passage a short student-friendly title string (title must not be null for these passages).
- Set \`passageQuestionCounts\` to [${Array.from({ length: numberOfPassages }, () => questionsPerPassage).join(", ")}].
- Flatten questions and answerKey in passage order; total length must be ${numberOfPassages * questionsPerPassage}.
- Every question must refer to and be answerable from its linked passage. Never leave passage bodies blank.
- Also set legacy \`passage\` / \`passageTitle\` to the first passage for compatibility.`;
}
