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

function isClerkSessionNetworkError(error: unknown): boolean {
  const parts: string[] = [];

  function collect(value: unknown, depth = 0) {
    if (depth > 6 || value == null) return;
    if (value instanceof Error) {
      parts.push(value.name, value.message);
      collect(value.cause, depth + 1);
      return;
    }
    if (typeof value === "object" && "message" in value) {
      const message = (value as { message?: unknown }).message;
      if (typeof message === "string") parts.push(message);
      if ("cause" in value) collect((value as { cause?: unknown }).cause, depth + 1);
      return;
    }
    if (typeof value === "string") parts.push(value);
  }

  collect(error);
  const flat = parts.join(" ");
  return (
    flat.includes("clerk.accounts.dev") &&
    (flat.includes("ClerkJS: Network error") ||
      flat.includes("Failed to fetch") ||
      flat.includes("/sessions/") ||
      flat.includes("/touch"))
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
      if (isClerkSessionNetworkError(event.reason)) {
        event.preventDefault();
        console.warn(
          "[clerk] Session touch failed (network). Sign-in state may be stale until connectivity returns.",
        );
        return;
      }
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
