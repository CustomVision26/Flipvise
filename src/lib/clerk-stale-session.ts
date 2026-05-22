import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import type { NextRequest, NextResponse } from "next/server";

/** Route handler clears cookies; safe from Server Components and Server Actions. */
export const CLEAR_STALE_SESSION_PATH = "/api/auth/clear-stale-session";

export function isClerkUserNotFoundError(error: unknown): boolean {
  if (!isClerkAPIResponseError(error)) return false;

  const status =
    "status" in error && typeof error.status === "number"
      ? error.status
      : "statusCode" in error && typeof (error as { statusCode: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null;
  if (status === 404) return true;

  if (/not found/i.test(error.message)) return true;

  return (
    error.errors?.some(
      (e) =>
        (e.code ?? "").toLowerCase() === "resource_not_found" ||
        /not found/i.test(e.message ?? "") ||
        /not found/i.test(e.longMessage ?? ""),
    ) ?? false
  );
}

export function isStaleOrMissingSessionError(error: unknown): boolean {
  const text = (() => {
    if (error instanceof Error) return error.message;
    if (isClerkAPIResponseError(error)) {
      const fromApi = error.errors
        ?.map((e) => `${e.code ?? ""} ${e.message ?? ""} ${e.longMessage ?? ""}`)
        .join(" ");
      return [error.message, fromApi].filter(Boolean).join(" ");
    }
    return String(error);
  })();

  return /no session was found/i.test(text);
}

export function isClerkAuthCookieName(name: string): boolean {
  return (
    name === "__session" ||
    name.startsWith("__session_") ||
    name === "__client_uat" ||
    name.startsWith("__client_uat_") ||
    name.startsWith("__clerk") ||
    name.startsWith("__refresh")
  );
}

/** Clears Clerk session cookies on a redirect response (middleware or route handlers). */
export function clearClerkCookiesOnResponse(
  request: Pick<NextRequest, "cookies">,
  response: NextResponse,
): void {
  for (const { name } of request.cookies.getAll()) {
    if (isClerkAuthCookieName(name)) {
      response.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
  }
}
