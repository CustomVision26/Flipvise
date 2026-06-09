"use client";

/**
 * Scopes dark theme to the homepage subtree without mutating `<html>`.
 * A MutationObserver on `documentElement` fought next-themes / layout
 * `data-ui-theme` and caused React teardown races (`removeChild on null`).
 */
export function ForceDarkTheme({ children }: { children: React.ReactNode }) {
  return <div className="dark min-h-full w-full">{children}</div>;
}
