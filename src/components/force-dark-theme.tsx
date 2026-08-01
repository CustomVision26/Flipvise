"use client";

import type { ReactNode } from "react";

/**
 * Scopes dark theme to a subtree without mutating `<html>`.
 * Kept as a tiny client module (imported by PublicMarketingPageChrome).
 * If Turbopack reports a missing module factory for this file, hard-reload
 * or clear `.next` — it is usually a stale HMR/cache issue, not app logic.
 */
export function ForceDarkTheme({ children }: { children: ReactNode }) {
  return <div className="dark min-h-full w-full">{children}</div>;
}
