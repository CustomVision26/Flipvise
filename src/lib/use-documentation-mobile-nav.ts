"use client";

import { useCallback, useEffect, useState } from "react";
import { useNarrowViewport } from "@/lib/use-narrow-viewport";

/** Mobile / narrow layout: topic list vs content panel (master–detail). */
export function useDocumentationMobileNav(options: {
  mounted: boolean;
  activeId: string | null;
}) {
  const { mounted, activeId } = options;
  const isNarrow = useNarrowViewport();
  const [mobileContentOpen, setMobileContentOpen] = useState(false);

  useEffect(() => {
    if (!isNarrow) {
      setMobileContentOpen(false);
      return;
    }
    if (!mounted) return;
    if (activeId) {
      setMobileContentOpen(true);
    }
  }, [mounted, activeId, isNarrow]);

  const openMobileContent = useCallback(() => {
    setMobileContentOpen(true);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, []);

  const closeMobileContent = useCallback(() => {
    setMobileContentOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return {
    mobileContentOpen,
    showMobileBack: mounted && mobileContentOpen,
    openMobileContent,
    closeMobileContent,
  };
}

/** Tailwind visibility: one panel on mobile, both on lg+. SSR-safe until `layoutReady`. */
export function documentationTocAsideClass(
  mobileContentOpen: boolean,
  layoutReady: boolean,
): string {
  if (!layoutReady) return "block";
  return mobileContentOpen ? "max-lg:hidden lg:block" : "block";
}

export function documentationContentPanelClass(
  mobileContentOpen: boolean,
  layoutReady: boolean,
): string {
  if (!layoutReady) return "max-lg:hidden lg:block";
  return !mobileContentOpen ? "max-lg:hidden lg:block" : "block";
}
