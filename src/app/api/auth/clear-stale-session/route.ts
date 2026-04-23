import { NextResponse, type NextRequest } from "next/server";
import { clearClerkCookiesOnResponse } from "@/lib/clerk-stale-session";

/**
 * Clears invalid Clerk cookies when the browser still holds a session id
 * that no longer exists server-side, then sends the user home to sign in again.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  const res = NextResponse.redirect(url);
  clearClerkCookiesOnResponse(request, res);
  return res;
}
