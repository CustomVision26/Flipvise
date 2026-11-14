import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";
import {
  ARTWORK_SCENES,
  artworkSceneAfterSteps,
  isArtworkScene,
  type ArtworkScene,
  type ArtworkTheme,
} from "../../src/lib/artwork-background";
import {
  backgroundSceneStep,
  clampBackgroundChangeHours,
  DEFAULT_BACKGROUND_CHANGE_HOURS,
} from "../../src/lib/illustrated-appearance";
import {
  NATIVE_ARTWORK_SCHEDULE_KEY,
  parseNativeArtworkSchedule,
  type NativeArtworkSchedule,
} from "../../src/lib/native-artwork-schedule";

const LOCAL_SCHEDULE_KEY = "flipvise-offline-artwork-schedule";

function sceneUrl(scene: ArtworkScene, theme: ArtworkTheme): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}artwork/${scene}-${theme}.png`;
}

async function readSchedule(): Promise<NativeArtworkSchedule> {
  let raw: string | null = null;
  try {
    raw = (await Preferences.get({ key: NATIVE_ARTWORK_SCHEDULE_KEY })).value;
  } catch {
    raw = null;
  }
  if (!raw) {
    try {
      raw = window.localStorage.getItem(LOCAL_SCHEDULE_KEY);
    } catch {
      raw = null;
    }
  }
  const parsed = parseNativeArtworkSchedule(raw);
  if (parsed) return parsed;

  let scene: ArtworkScene = "woodland";
  try {
    const stored = window.localStorage.getItem("flipvise-artwork-scene-v2");
    if (isArtworkScene(stored)) scene = stored;
  } catch {
    scene = "woodland";
  }
  const created: NativeArtworkSchedule = {
    enabled: true,
    hours: DEFAULT_BACKGROUND_CHANGE_HOURS,
    startedAt: new Date().toISOString(),
    scene,
  };
  try {
    window.localStorage.setItem(LOCAL_SCHEDULE_KEY, JSON.stringify(created));
  } catch {
    // The scene still advances for this launch.
  }
  return created;
}

export function AppScene() {
  const [theme, setTheme] = useState<ArtworkTheme>("dark");
  const [scene, setScene] = useState<ArtworkScene>("woodland");

  useEffect(() => {
    const root = document.documentElement;
    const readTheme = () => {
      setTheme(root.dataset.theme === "light" ? "light" : "dark");
    };
    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const arm = async () => {
      const schedule = await readSchedule();
      if (cancelled) return;
      const step = backgroundSceneStep({
        nowMs: Date.now(),
        startedAtMs: schedule.startedAt ? Date.parse(schedule.startedAt) : null,
        hours: schedule.hours,
        enabled: schedule.enabled,
        sceneCount: ARTWORK_SCENES.length,
      });
      setScene(artworkSceneAfterSteps(schedule.scene, step));
      const interval = clampBackgroundChangeHours(schedule.hours) * 60 * 60 * 1000;
      let delay = interval;
      if (schedule.enabled && schedule.startedAt) {
        const start = Date.parse(schedule.startedAt);
        if (Number.isFinite(start)) {
          const elapsed = Date.now() - start;
          const into = ((elapsed % interval) + interval) % interval;
          delay = Math.max(60_000, interval - into);
        }
      }
      timer = window.setTimeout(() => {
        void arm();
      }, delay);
    };

    void arm();
    const onVisible = () => {
      if (document.visibilityState === "visible") void arm();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="app-scene" aria-hidden>
      <img className="app-scene__image" src={sceneUrl(scene, theme)} alt="" />
    </div>
  );
}
