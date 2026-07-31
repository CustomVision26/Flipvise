/**
 * Local draft cache for offline writing. Syncs to the server when online
 * via {@link saveEssayDraftAction}.
 */

const STORAGE_PREFIX = "flipvise:essay-draft:";

export type LocalEssayDraft = {
  documentId: number;
  body: string;
  wordCount: number;
  /** Per-section draft text keyed by section id (essay builder v2). */
  sectionsContent?: Record<string, string>;
  updatedAt: string;
};

function storageKey(documentId: number, userId: string): string {
  return `${STORAGE_PREFIX}${userId}:${documentId}`;
}

export function readLocalEssayDraft(
  documentId: number,
  userId: string,
): LocalEssayDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(documentId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalEssayDraft;
    if (parsed.documentId !== documentId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalEssayDraft(
  userId: string,
  draft: Omit<LocalEssayDraft, "updatedAt">,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: LocalEssayDraft = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKey(draft.documentId, userId), JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore
  }
}

export function clearLocalEssayDraft(documentId: number, userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(documentId, userId));
  } catch {
    // ignore
  }
}
