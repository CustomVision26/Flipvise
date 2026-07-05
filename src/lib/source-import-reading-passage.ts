export const READING_PASSAGE_MC_GENERATION_PROMPT = `READING PASSAGE MULTIPLE CHOICE MODE IS ENABLED.

For EVERY card, use this structure instead of standard term/definition or short Q&A cards:

front — use exactly these section labels and blank lines (plain text only, no markdown). Do NOT put answer choices on the front:

Passage

[Write 3–5 sentences of original reading material appropriate for the deck grade and topic. Ground content in the provided source when possible. Each card should use a different passage when possible.]

Question

[One comprehension question that can only be answered from the passage.]

The front must END after the question — no A/B/C/D options, no answer text, no letter labels on the front.

back — the full text of the CORRECT answer only (the right choice among four plausible options you invent). Do not prefix with "A." or any letter.

distractors — array of exactly the three INCORRECT answer texts (no letter prefixes). Together with back, these form four multiple-choice options shown during quiz/study.

Example front:
Passage

Sarah enjoys reading books after school. Every Tuesday, she visits the community library with her brother. She borrows two books each week and returns them on time. Sarah believes that reading helps her learn new words and improve her imagination.

Question

Why does Sarah like reading books?

Example back: "Because it helps her learn new words and improve her imagination."
Example distractors: ["Because she wants to avoid doing her homework.", "Because her brother forces her to read every day.", "Because the library gives her free toys."]

Rules:
- Passages must be age-appropriate for the deck
- Invent four plausible answer options internally; store the correct one on back and the three wrong ones in distractors
- Wrong answers must be plausible but clearly incorrect after reading the passage
- Do not use markdown, emoji, checkmarks, or bullet lists on the front
- Never list A., B., C., or D. on the front
- Always return exactly 3 distractors — the three wrong answer texts`;

/** Removes A–D option lines accidentally included on reading-passage card fronts. */
export function cleanReadingPassageFront(front: string): string {
  return front
    .split("\n")
    .filter((line) => !/^\s*[A-D][.)]\s+\S/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isReadingPassageMcEnabled(value: unknown): boolean {
  return value === true || value === "true";
}
