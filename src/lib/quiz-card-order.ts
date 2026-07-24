/** Stable per-member quiz card presentation order (admin-controlled shuffle). */

export type QuizCardOrderRecord = {
  cardIds: number[];
  shuffledAt: string;
};

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

export function shuffleArrayCopy<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function orderKey(cardIds: number[]): string {
  return cardIds.join(",");
}

/**
 * Builds a unique (when mathematically possible) card-order permutation for each viewer.
 * When member count exceeds n!, some duplicates are unavoidable after exhausting uniqueness.
 */
export function buildUniqueQuizCardOrders(
  viewerUserIds: string[],
  cardIds: number[],
): Map<string, number[]> {
  const uniqueViewers = [...new Set(viewerUserIds.filter(Boolean))];
  const base = [...new Set(cardIds)].filter((id) => Number.isFinite(id) && id > 0);
  const out = new Map<string, number[]>();
  if (uniqueViewers.length === 0 || base.length === 0) return out;

  const maxUnique = Math.min(factorial(base.length), 50_000);
  const used = new Set<string>();

  for (const viewerUserId of uniqueViewers) {
    let order = shuffleArrayCopy(base);
    let key = orderKey(order);
    let attempts = 0;
    while (used.has(key) && used.size < maxUnique && attempts < 80) {
      order = shuffleArrayCopy(base);
      key = orderKey(order);
      attempts++;
    }
    used.add(key);
    out.set(viewerUserId, order);
  }

  return out;
}

/** Reorder questions to match stored card ids; append any missing questions at the end. */
export function applyQuizCardOrder<T extends { cardId: number }>(
  questions: T[],
  cardOrder: number[] | null | undefined,
): T[] {
  if (!cardOrder || cardOrder.length === 0 || questions.length === 0) {
    return questions;
  }
  const byId = new Map(questions.map((q) => [q.cardId, q]));
  const ordered: T[] = [];
  const seen = new Set<number>();
  for (const cardId of cardOrder) {
    const q = byId.get(cardId);
    if (!q || seen.has(cardId)) continue;
    ordered.push(q);
    seen.add(cardId);
  }
  for (const q of questions) {
    if (!seen.has(q.cardId)) ordered.push(q);
  }
  return ordered;
}

export function parseQuizCardOrder(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = raw
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((id) => Number.isFinite(id) && id > 0);
  return ids.length > 0 ? ids : null;
}
