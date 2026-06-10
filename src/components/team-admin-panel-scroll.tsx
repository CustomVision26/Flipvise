"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function scrollToPanel(panelId: string) {
  window.setTimeout(() => {
    document.getElementById(panelId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 120);
}

/** Scrolls to `#team-admin-panel-*` after tab navigation (mobile-friendly). */
export function TeamAdminPanelScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const hashId = window.location.hash.replace(/^#/, "");
    if (hashId.startsWith("team-admin-panel-")) {
      scrollToPanel(hashId);
    }
  }, [pathname]);

  return null;
}

export function scrollToTeamAdminPanel(panelId: string) {
  const base = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", `${base}#${panelId}`);
  scrollToPanel(panelId);
}
