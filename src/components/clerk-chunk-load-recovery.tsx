"use client";

import { useEffect } from "react";

const RELOAD_KEY = "flipvise-clerk-chunk-reload";

function isClerkChunkLoadFailure(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : "";

  if (!message.includes("clerk.accounts.dev") && !message.includes("@clerk/ui")) {
    return false;
  }

  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("timeout") ||
    message.includes("Failed to fetch dynamically imported module")
  );
}

/**
 * Clerk loads UI sub-chunks from *.clerk.accounts.dev. Slow networks, ad blockers,
 * or CDN hiccups can throw ChunkLoadError. One automatic hard reload usually fixes it.
 */
export function ClerkChunkLoadRecovery() {
  useEffect(() => {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") {
      sessionStorage.removeItem(RELOAD_KEY);
    }

    function recover(error: unknown) {
      if (!isClerkChunkLoadFailure(error)) return;
      if (sessionStorage.getItem(RELOAD_KEY) === "1") return;

      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      recover(event.error ?? event.message);
    }

    function onRejection(event: PromiseRejectionEvent) {
      recover(event.reason);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
