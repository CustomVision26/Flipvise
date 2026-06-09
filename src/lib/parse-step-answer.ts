export type AnswerBlock =
  | { kind: "step"; stepNumber: number; title: string; work: string[] }
  | { kind: "final"; label: string; value: string }
  | { kind: "line"; text: string };

const STEP_LINE_RE = /^Step\s*(\d+)\s*:\s*(.*)$/i;
const FINAL_LINE_RE = /^(Answer|Result|Solution|∴)\s*:\s*(.*)$/i;

export function isStepAnswer(text: string): boolean {
  return /\bStep\s*\d+\s*:/i.test(text);
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
        if (STEP_LINE_RE.test(next)) break;

        const finalMatch = next.match(FINAL_LINE_RE);
        if (finalMatch) {
          blocks.push({
            kind: "final",
            label: finalMatch[1]!,
            value: finalMatch[2]?.trim() || next,
          });
          i += 1;
          break;
        }

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

  return blocks;
}
