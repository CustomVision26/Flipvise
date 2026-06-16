"use client";

import { useEffect, useState } from "react";

const NARROW_VIEWPORT_QUERY = "(max-width: 1023px)";

function readIsNarrow(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
}

/** True at viewport widths below Tailwind `lg` (1024px). */
export function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    const sync = () => setIsNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isNarrow;
}

export function isNarrowViewportNow(): boolean {
  return readIsNarrow();
}
