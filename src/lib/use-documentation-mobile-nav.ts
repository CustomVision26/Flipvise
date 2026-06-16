"use client";

import { useCallback, useEffect, useState } from "react";
import { useNarrowViewport } from "@/lib/use-narrow-viewport";

/** Mobile / narrow layout: TOC list vs content panel (master–detail). */
export function useDocumentationMobileNav(options: {
  mounted: boolean;
  activeId: string | null;
}) {
  const { mounted, activeId } = options;
  const isNarrow = useNarrowViewport();
  const [mobileContentOpen, setMobileContentOpen] = useState(false);

  useEffect(() => {
    if (!mounted || !isNarrow) return;
    if (activeId) {
      setMobileContentOpen(true);
    }
  }, [mounted, isNarrow, activeId]);

  useEffect(() => {
    if (!isNarrow) {
      setMobileContentOpen(false);
    }
  }, [isNarrow]);

  const openMobileContent = useCallback(() => {
    if (isNarrow) {
      setMobileContentOpen(true);
    }
  }, [isNarrow]);

  const closeMobileContent = useCallback(() => {
    setMobileContentOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const showToc = !isNarrow || !mobileContentOpen;
  const showContent = !isNarrow || mobileContentOpen;
  const showMobileBack = isNarrow && mobileContentOpen;

  return {
    isNarrow,
    showToc,
    showContent,
    showMobileBack,
    openMobileContent,
    closeMobileContent,
  };
}
