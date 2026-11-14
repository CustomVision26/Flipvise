export type OfflineDeckViewMode = "detail" | "grid" | "list" | "thumbnail";

export type OfflineDeckSort =
  | "updated-desc"
  | "updated-asc"
  | "name-asc"
  | "name-desc"
  | "cards-desc"
  | "cards-asc";

const VIEW_KEY = "flipvise.offline.decks.view";
const SORT_KEY = "flipvise.offline.decks.sort";

const VIEWS: OfflineDeckViewMode[] = ["detail", "grid", "list", "thumbnail"];
const SORTS: OfflineDeckSort[] = [
  "updated-desc",
  "updated-asc",
  "name-asc",
  "name-desc",
  "cards-desc",
  "cards-asc",
];

export function loadDeckViewMode(): OfflineDeckViewMode {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    if (raw && VIEWS.includes(raw as OfflineDeckViewMode)) {
      return raw as OfflineDeckViewMode;
    }
  } catch {
    // ignore
  }
  return "detail";
}

export function saveDeckViewMode(mode: OfflineDeckViewMode): void {
  try {
    localStorage.setItem(VIEW_KEY, mode);
  } catch {
    // ignore
  }
}

export function loadDeckSort(): OfflineDeckSort {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (raw && SORTS.includes(raw as OfflineDeckSort)) {
      return raw as OfflineDeckSort;
    }
  } catch {
    // ignore
  }
  return "updated-desc";
}

export function saveDeckSort(sort: OfflineDeckSort): void {
  try {
    localStorage.setItem(SORT_KEY, sort);
  } catch {
    // ignore
  }
}

export const VIEW_LABELS: Record<
  OfflineDeckViewMode,
  { title: string; hint: string }
> = {
  detail: { title: "Detail", hint: "Artwork, title, and details" },
  grid: { title: "Grid", hint: "Illustrated cards" },
  list: { title: "List", hint: "One deck per row" },
  thumbnail: { title: "Thumbnail", hint: "Small picture tiles" },
};

export const SORT_LABELS: Record<OfflineDeckSort, string> = {
  "updated-desc": "Recently updated",
  "updated-asc": "Oldest updated",
  "name-asc": "Name A → Z",
  "name-desc": "Name Z → A",
  "cards-desc": "Most cards",
  "cards-asc": "Fewest cards",
};
