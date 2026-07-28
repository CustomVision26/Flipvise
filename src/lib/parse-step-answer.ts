export type AnswerBlock =
  | { kind: "step"; stepNumber: number; title: string; work: string[] }
  | { kind: "final"; label: string; value: string }
  | { kind: "line"; text: string };

const STEP_LINE_RE = /^Step\s*(\d+)\s*:\s*(.*)$/i;
const FINAL_LINE_RE = /^(Answer|Result|Solution|∴)\s*:\s*(.*)$/i;

export function isStepAnswer(text: string): boolean {
  return /\bStep\s*\d+\s*:/i.test(text);
}

/**
 * Prompt contract for study-mode–compatible worked answers.
 * Standard Review / AI Recall render this via FormattedCardAnswer;
 * Quiz mode shortens options to the final Answer: line for display.
 */
export const STUDY_MODE_STEP_ANSWER_PROMPT = `Use EXACTLY this uniform format (plain newlines, no markdown, no bullet points):

Step 1: [Brief label describing the action]
[The computation or reasoning for this step]
Step 2: [Brief label describing the action]
[The computation or reasoning for this step]
(continue for as many steps as needed)
Answer: [The final result]`;

/**
 * When a choice/back stores a full workout, return the final answer
 * (text after Answer:/Result:/Solution:) for short quiz options / distractors.
 */
export function extractStepFinalAnswer(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || !isStepAnswer(trimmed)) return null;

  let lastExplicit: string | null = null;
  const explicitRe = /(?:Answer|Result|Solution|∴)\s*:\s*([^\n]+)/gi;
  let em: RegExpExecArray | null;
  while ((em = explicitRe.exec(trimmed)) !== null) {
    const v = em[1]?.trim();
    if (v) lastExplicit = v;
  }
  if (lastExplicit) return lastExplicit;

  const lines = trimmed
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (!/^Step\s*\d+\s*:/i.test(line) && line.length > 0) return line;
  }

  return null;
}

export function parseStepAnswer(text: string): AnswerBlock[] {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!isStepAnswer(text)) {
    if (lines.length === 0) return [{ kind: "line", text }];
    return lines.map((line) => ({ kind: "line", text: line }));
  }

  const blocks: AnswerBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const stepMatch = line.match(STEP_LINE_RE);

    if (stepMatch) {
      const stepNumber = Number.parseInt(stepMatch[1]!, 10);
      const title = stepMatch[2]?.trim() ?? "";
      const work: string[] = [];
      i += 1;

      while (i < lines.length) {
        const next = lines[i]!;
        // Stop at the next step or the final answer — leave those lines for
        // the outer loop so the step is emitted before Answer/Result.
        if (STEP_LINE_RE.test(next) || FINAL_LINE_RE.test(next)) break;

        work.push(next);
        i += 1;
      }

      blocks.push({ kind: "step", stepNumber, title, work });
      continue;
    }

    const finalMatch = line.match(FINAL_LINE_RE);
    if (finalMatch) {
      blocks.push({
        kind: "final",
        label: finalMatch[1]!,
        value: finalMatch[2]?.trim() || line,
      });
      i += 1;
      continue;
    }

    blocks.push({ kind: "line", text: line });
    i += 1;
  }

  // Always show the marked final answer after all steps / body lines.
  const finals = blocks.filter((b) => b.kind === "final");
  if (finals.length === 0) return blocks;
  return [...blocks.filter((b) => b.kind !== "final"), ...finals];
}
