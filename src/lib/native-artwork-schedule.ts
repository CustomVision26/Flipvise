import { isArtworkScene, type ArtworkScene } from "@/lib/artwork-background";
import { clampBackgroundChangeHours } from "@/lib/illustrated-appearance";
import { isFlipviseNativeApp } from "@/lib/offline/is-flipvise-native-app";

/** Shared by the online dashboard and the offline study shell. */
export const NATIVE_ARTWORK_SCHEDULE_KEY = "flipvise-artwork-schedule";

export type NativeArtworkSchedule = {
  enabled: boolean;
  hours: number;
  startedAt: string | null;
  scene: ArtworkScene;
};

export function parseNativeArtworkSchedule(
  raw: string | null | undefined,
): NativeArtworkSchedule | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<NativeArtworkSchedule>;
    if (!isArtworkScene(value.scene)) return null;
    return {
      enabled: value.enabled !== false,
      hours: clampBackgroundChangeHours(value.hours),
      startedAt:
        typeof value.startedAt === "string" && Number.isFinite(Date.parse(value.startedAt))
          ? new Date(value.startedAt).toISOString()
          : null,
      scene: value.scene,
    };
  } catch {
    return null;
  }
}

/** The Capacitor app shares this preference between the website and offline study. */
export async function persistNativeArtworkSchedule(
  schedule: NativeArtworkSchedule,
): Promise<void> {
  if (!isFlipviseNativeApp()) return;
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({
      key: NATIVE_ARTWORK_SCHEDULE_KEY,
      value: JSON.stringify(schedule),
    });
  } catch {
    // The website still paints its own scene when Preferences is unavailable.
  }
}
