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

export function normalizeHomeworkResult<T extends { questions: string[]; answerKey: string[] }>(
  result: T,
): T {
  return {
    ...result,
    questions: normalizeHomeworkListItems(result.questions),
    answerKey: normalizeHomeworkListItems(result.answerKey),
  };
}
