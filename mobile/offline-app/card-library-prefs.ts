export type OfflineCardViewMode = "detail" | "grid" | "list" | "thumbnail";

export type OfflineCardSort =
  | "updated-desc"
  | "updated-asc"
  | "front-asc"
  | "front-desc"
  | "back-asc"
  | "back-desc";

const VIEW_KEY = "flipvise.offline.cards.view";
const SORT_KEY = "flipvise.offline.cards.sort";

const VIEWS: OfflineCardViewMode[] = ["detail", "grid", "list", "thumbnail"];
const SORTS: OfflineCardSort[] = [
  "updated-desc",
  "updated-asc",
  "front-asc",
  "front-desc",
  "back-asc",
  "back-desc",
];

export function loadCardViewMode(): OfflineCardViewMode {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (raw && VIEWS.includes(raw as OfflineCardViewMode)) {
      return raw as OfflineCardViewMode;
    }
  } catch {
    // ignore
  }
  return "grid";
}

export function saveCardViewMode(mode: OfflineCardViewMode): void {
  try {
    localStorage.setItem(VIEW_KEY, mode);
  } catch {
    // ignore
  }
}

export function loadCardSort(): OfflineCardSort {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (raw && SORTS.includes(raw as OfflineCardSort)) {
      return raw as OfflineCardSort;
    }
  } catch {
    // ignore
  }
  return "updated-desc";
}

export function saveCardSort(sort: OfflineCardSort): void {
  try {
    localStorage.setItem(SORT_KEY, sort);
  } catch {
    // ignore
  }
}

export const CARD_VIEW_LABELS: Record<
  OfflineCardViewMode,
  { title: string; hint: string }
> = {
  detail: { title: "Detail", hint: "Front, back, and updated date" },
  grid: { title: "Grid", hint: "Two-column cards" },
  list: { title: "List", hint: "Compact single-line rows" },
  thumbnail: { title: "Thumbnail", hint: "Small visual tiles" },
};

export const CARD_SORT_LABELS: Record<OfflineCardSort, string> = {
  "updated-desc": "Recently updated",
  "updated-asc": "Oldest updated",
  "front-asc": "Front A → Z",
  "front-desc": "Front Z → A",
  "back-asc": "Back A → Z",
  "back-desc": "Back Z → A",
};
