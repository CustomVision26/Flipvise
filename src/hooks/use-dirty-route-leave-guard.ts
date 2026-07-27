"use client";

import { useEffect, useRef, type RefObject } from "react";

/** Sentinel destination when the user presses the browser Back button. */
export const BROWSER_BACK_EXIT_HREF = "__browser_back__";

type RouterPush = {
  push: (href: string) => void;
};

function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}

function resolveInternalNavigationHref(
  anchor: HTMLAnchorElement,
  event: MouseEvent,
): string | null {
  if (isModifiedClick(event)) return null;
  if (event.defaultPrevented) return null;

  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const hrefAttr = anchor.getAttribute("href");
  if (
    !hrefAttr ||
    hrefAttr.startsWith("#") ||
    hrefAttr.startsWith("mailto:") ||
    hrefAttr.startsWith("tel:") ||
    hrefAttr.startsWith("javascript:")
  ) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(hrefAttr, window.location.href);
  } catch {
    return null;
  }

  if (url.origin !== window.location.origin) return null;

  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return null;

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Blocks same-origin in-app link clicks (and browser Back when feasible) while
 * `enabled` is true. Call `proceedAfterDirtyLeaveConfirm` after the user confirms leave.
 */
export function useDirtyRouteLeaveGuard({
  enabled,
  onBlock,
  allowNavigationRef,
}: {
  enabled: boolean;
  onBlock: (destinationHref: string) => void;
  allowNavigationRef: RefObject<boolean>;
}) {
  const onBlockRef = useRef(onBlock);
  onBlockRef.current = onBlock;

  useEffect(() => {
    if (!enabled) return;

    function handleClick(event: MouseEvent) {
      if (allowNavigationRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const destination = resolveInternalNavigationHref(anchor, event);
      if (!destination) return;

      event.preventDefault();
      event.stopPropagation();
      onBlockRef.current(destination);
    }

    function handlePopState() {
      if (allowNavigationRef.current) return;
      // Re-trap so the URL stays on this page while the confirm dialog is open.
      window.history.pushState(
        { __dirtyRouteLeaveGuard: true },
        "",
        window.location.href,
      );
      onBlockRef.current(BROWSER_BACK_EXIT_HREF);
    }

    window.history.pushState(
      { __dirtyRouteLeaveGuard: true },
      "",
      window.location.href,
    );
    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [allowNavigationRef, enabled]);
}

/** Navigate to the intercepted destination after a confirmed leave. */
export function proceedAfterDirtyLeaveConfirm(
  router: RouterPush,
  destinationHref: string | null,
  fallbackHref: string,
) {
  if (destinationHref === BROWSER_BACK_EXIT_HREF) {
    // Trap pushState + cancelled Back leave two same-URL entries above the prior page.
    window.history.go(-2);
    return;
  }
  router.push(destinationHref ?? fallbackHref);
}
