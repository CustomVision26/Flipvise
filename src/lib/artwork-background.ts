/** Decorative page scenes. The active theme only swaps the light or dark file. */

export const ARTWORK_SCENES = ["woodland", "learning", "discovery"] as const;

export type ArtworkScene = (typeof ARTWORK_SCENES)[number];

export type ArtworkTheme = "light" | "dark";

export const ARTWORK_SCENE_STORAGE_KEY = "flipvise-artwork-scene-v2";

export function isArtworkScene(value: string | null | undefined): value is ArtworkScene {
  return value === "woodland" || value === "learning" || value === "discovery";
}

/**
 * The app's active theme is next-themes `resolvedTheme` (the class on `<html>`).
 * System mode is not a paint theme here: this project keeps `enableSystem` off
 * and stores only light or dark.
 */
export function resolveArtworkTheme(
  resolvedTheme: string | null | undefined,
): ArtworkTheme | null {
  if (resolvedTheme === "light" || resolvedTheme === "dark") return resolvedTheme;
  return null;
}

export function artworkBackgroundPath(scene: ArtworkScene, theme: ArtworkTheme): string {
  return `/artwork/backgrounds/${scene}-${theme}.png`;
}

export function pickArtworkScene(random: () => number = Math.random): ArtworkScene {
  const index = Math.min(
    ARTWORK_SCENES.length - 1,
    Math.max(0, Math.floor(random() * ARTWORK_SCENES.length)),
  );
  return ARTWORK_SCENES[index] ?? "woodland";
}

/** Advance a stored scene. Step 0 keeps it. */
export function artworkSceneAfterSteps(scene: ArtworkScene, step: number): ArtworkScene {
  if (step <= 0) return scene;
  const start = Math.max(0, ARTWORK_SCENES.indexOf(scene));
  return ARTWORK_SCENES[(start + step) % ARTWORK_SCENES.length] ?? scene;
}

/** Keep a stored scene. A new tab with nothing stored picks once. */
export function selectArtworkScene(
  stored: string | null | undefined,
  random: () => number = Math.random,
): ArtworkScene {
  if (isArtworkScene(stored)) return stored;
  return pickArtworkScene(random);
}

export function readStoredArtworkScene(storage: Pick<Storage, "getItem"> | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(ARTWORK_SCENE_STORAGE_KEY);
  } catch {
    return null;
  }
}
