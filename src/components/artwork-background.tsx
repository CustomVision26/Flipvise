"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import {
  ARTWORK_SCENE_STORAGE_KEY,
  artworkBackgroundPath,
  readStoredArtworkScene,
  resolveArtworkTheme,
  selectArtworkScene,
  type ArtworkScene,
} from "@/lib/artwork-background";

/**
 * Fixed decorative backdrop. The scene is chosen once per tab and only the
 * light or dark file changes with the active theme.
 */
export function ArtworkBackground() {
  const { resolvedTheme } = useTheme();
  const theme = resolveArtworkTheme(resolvedTheme);
  const [scene, setScene] = React.useState<ArtworkScene | null>(null);
  const [imageReady, setImageReady] = React.useState(false);

  React.useEffect(() => {
    const stored = readStoredArtworkScene(window.sessionStorage);
    const next = selectArtworkScene(stored);
    if (stored !== next) {
      try {
        window.sessionStorage.setItem(ARTWORK_SCENE_STORAGE_KEY, next);
      } catch {
        // Private mode can block storage. The scene still stays for this mount.
      }
    }
    setScene(next);
  }, []);

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
