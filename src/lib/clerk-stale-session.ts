import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import type { NextRequest, NextResponse } from "next/server";

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
