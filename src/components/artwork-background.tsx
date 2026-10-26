"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import {
  useBackgroundRotationNow,
  useEffectiveRotationStart,
} from "@/components/illustrated/use-background-rotation";
import { backgroundSceneStep } from "@/lib/illustrated-appearance";
import {
  ARTWORK_SCENE_STORAGE_KEY,
  artworkBackgroundPath,
  artworkSceneAfterSteps,
  readStoredArtworkScene,
  resolveArtworkTheme,
  selectArtworkScene,
  type ArtworkScene,
} from "@/lib/artwork-background";

/**
 * Decorative backdrop. Light and dark swap with the theme. When Change
 * background artwork is on, the scene advances on the saved hour interval.
 */
export function ArtworkBackground() {
  const { resolvedTheme } = useTheme();
  const appearance = useIllustratedAppearance();
  const theme = resolveArtworkTheme(resolvedTheme);
  const [baseScene, setBaseScene] = React.useState<ArtworkScene | null>(null);
  const [imageReady, setImageReady] = React.useState(false);
  const rotating = appearance.backgroundChangeEnabled;
  const startedAt = useEffectiveRotationStart(
    appearance.backgroundRotationStartedAt,
    rotating,
  );
  const now = useBackgroundRotationNow(rotating, appearance.backgroundChangeHours, startedAt);

  React.useEffect(() => {
    const stored = readStoredArtworkScene(window.localStorage);
    const next = selectArtworkScene(stored);
    if (stored !== next) {
      try {
        window.localStorage.setItem(ARTWORK_SCENE_STORAGE_KEY, next);
      } catch {
        // Private mode can block storage. The scene still stays for this mount.
      }
    }
    setBaseScene(next);
  }, []);

  const scene = baseScene
    ? artworkSceneAfterSteps(
        baseScene,
        backgroundSceneStep({
          nowMs: now,
          startedAtMs: startedAt ? Date.parse(startedAt) : null,
          hours: appearance.backgroundChangeHours,
          enabled: rotating,
          sceneCount: 3,
        }),
      )
    : null;

  const src = scene && theme ? artworkBackgroundPath(scene, theme) : null;

  React.useEffect(() => {
    if (!src) {
      setImageReady(false);
      return;
    }
    let cancelled = false;
    setImageReady(false);
    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setImageReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setImageReady(false);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  React.useEffect(() => {
    const root = document.documentElement;
    if (imageReady && scene) {
      root.dataset.artworkReady = "true";
      root.dataset.artworkScene = scene;
    } else {
      delete root.dataset.artworkReady;
      delete root.dataset.artworkScene;
    }
    return () => {
      delete root.dataset.artworkReady;
      delete root.dataset.artworkScene;
    };
  }, [imageReady, scene]);

  return (
    <div className="artwork-background" aria-hidden>
      <div className="artwork-background-base" />
      <div
        className="artwork-background-image"
        data-ready={imageReady ? "true" : "false"}
        style={imageReady && src ? { backgroundImage: `url("${src}")` } : undefined}
      />
      <div className="artwork-background-wash" />
    </div>
  );
}
