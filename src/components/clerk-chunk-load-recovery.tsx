"use client";

import { useEffect } from "react";

const RELOAD_KEY = "flipvise-clerk-chunk-reload";
const STALE_CLEAR_KEY = "flipvise-clerk-stale-clear";

function messageFromUnknown(error: unknown): string {
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
  return parts.join(" ");
}

function isClerkChunkLoadFailure(error: unknown): boolean {
  const message = messageFromUnknown(error);

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
  const flat = messageFromUnknown(error);
  return (
    flat.includes("clerk.accounts.dev") &&
    (flat.includes("ClerkJS: Network error") ||
      flat.includes("Failed to fetch") ||
      flat.includes("/sessions/") ||
      flat.includes("/touch"))
  );
}

/**
 * Stale WebView cookies (common after account delete) make Clerk spin forever:
 * "infinite redirect loop" / "keys do not match" / "No session was found".
 */
function isClerkStaleSessionFailure(error: unknown): boolean {
  const flat = messageFromUnknown(error);
  return (
    /infinite redirect loop/i.test(flat) ||
    /keys do not match/i.test(flat) ||
    /no session was found/i.test(flat) ||
    /no user was found/i.test(flat)
  );
}

function clearStaleClerkSessionOnce() {
  if (sessionStorage.getItem(STALE_CLEAR_KEY) === "1") return;
  sessionStorage.setItem(STALE_CLEAR_KEY, "1");
  window.location.href = "/api/auth/clear-stale-session";
}

/**
 * Clerk loads UI sub-chunks from *.clerk.accounts.dev. Slow networks, ad blockers,
 * or CDN hiccups can throw ChunkLoadError. One automatic hard reload usually fixes it.
 *
 * Also recovers from stale Android WebView cookies that leave Sign-In stuck on
 * "Connecting to sign-in services…".
 */
export function ClerkChunkLoadRecovery() {
  useEffect(() => {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") {
      sessionStorage.removeItem(RELOAD_KEY);
    }
    if (sessionStorage.getItem(STALE_CLEAR_KEY) === "1") {
      // Cleared once this tab — allow a future clear after a successful sign-in later.
      window.setTimeout(() => {
        try {
          sessionStorage.removeItem(STALE_CLEAR_KEY);
        } catch {
          // ignore
        }
      }, 15_000);
    }

    function recoverChunk(error: unknown) {
      if (!isClerkChunkLoadFailure(error)) return;
      if (sessionStorage.getItem(RELOAD_KEY) === "1") return;

      sessionStorage.setItem(RELOAD_KEY, "1");
      window.location.reload();
    }

    function onError(event: ErrorEvent) {
      const payload = event.error ?? event.message;
      if (isClerkStaleSessionFailure(payload)) {
        event.preventDefault();
        clearStaleClerkSessionOnce();
        return;
      }
      recoverChunk(payload);
    }

    function onRejection(event: PromiseRejectionEvent) {
      if (isClerkStaleSessionFailure(event.reason)) {
        event.preventDefault();
        clearStaleClerkSessionOnce();
        return;
      }
      if (isClerkSessionNetworkError(event.reason)) {
        event.preventDefault();
        console.warn(
          "[clerk] Session touch failed (network). Sign-in state may be stale until connectivity returns.",
        );
        return;
      }
      recoverChunk(event.reason);
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
