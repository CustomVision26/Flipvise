export type SavedWorkspaceScope = "personal" | number;

const STORAGE_KEY = "flipvise.offline.workspaceScope";

export function loadWorkspaceScope(): SavedWorkspaceScope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === "personal") return "personal";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : "personal";
  } catch {
    return "personal";
  }
}

export function saveWorkspaceScope(scope: SavedWorkspaceScope): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      scope === "personal" ? "personal" : String(scope),
    );
  } catch {
    // ignore
  }
}
