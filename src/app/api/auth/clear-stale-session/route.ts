import { NextResponse, type NextRequest } from "next/server";
import { clearClerkCookiesOnResponse } from "@/lib/clerk-stale-session";
import { detectNativeShellFromUserAgent } from "@/lib/native-shell-from-request";
import { nativeSignInPath } from "@/lib/native-auth-redirect";

/**
 * Clears invalid Clerk cookies when the browser still holds a session id
 * that no longer exists server-side, then sends the user home to sign in again.
 */
export async function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  const url = request.nextUrl.clone();
  if (detectNativeShellFromUserAgent(ua).isNativeShell) {
    const nativeTarget = new URL(
      nativeSignInPath("/dashboard"),
      request.nextUrl.origin,
    );
    url.pathname = nativeTarget.pathname;
    url.search = nativeTarget.search;
  } else {
    url.pathname = "/";
    url.search = "";
  }
  const res = NextResponse.redirect(url);
  clearClerkCookiesOnResponse(request, res);
  return res;
}
