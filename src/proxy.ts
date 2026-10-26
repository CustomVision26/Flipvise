import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import {
  clearClerkCookiesOnResponse,
  isStaleOrMissingSessionError,
} from "@/lib/clerk-stale-session";
import { detectNativeShellFromUserAgent } from "@/lib/native-shell-from-request";

/**
 * Keep Clerk's rewrite on the same origin as the incoming request.
 * On Render, a rewrite to the public host is treated as external and the
 * page renders without Clerk's auth headers, so auth() cannot see clerkMiddleware().
 */
function keepRewriteOnRequestOrigin(request: NextRequest, response: Response) {
  const rewrite = response.headers.get("x-middleware-rewrite");
  if (!rewrite) return response;

  let rewriteUrl: URL;
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
    rewriteUrl = new URL(rewrite, requestUrl);
  } catch {
    return response;
  }

  if (rewriteUrl.origin === requestUrl.origin) return response;

  const aligned = new URL(
    `${rewriteUrl.pathname}${rewriteUrl.search}${rewriteUrl.hash}`,
    requestUrl,
  );
  response.headers.set("x-middleware-rewrite", aligned.href);
  return response;
}

const clerk = clerkMiddleware((_auth, request) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-search", request.nextUrl.search);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  try {
    const response = await clerk(request, event);
    return keepRewriteOnRequestOrigin(request, response);
  } catch (error) {
    if (isStaleOrMissingSessionError(error)) {
      const ua = request.headers.get("user-agent") ?? "";
      const url = request.nextUrl.clone();
      if (detectNativeShellFromUserAgent(ua).isNativeShell) {
        url.pathname = "/api/auth/clear-stale-session";
        url.search = "";
      } else {
        url.pathname = "/";
        url.search = "";
      }
      const res = NextResponse.redirect(url);
      clearClerkCookiesOnResponse(request, res);
      return res;
    }
    throw error;
  }
}

export const config = {
  matcher: [
    // Exclude Next internals, static assets, and billing webhooks from Clerk (Stripe needs raw body).
    "/((?!_next|api/webhooks|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Other API routes (non-webhook) and tRPC still run through Clerk.
    "/(api(?!/webhooks)|trpc)(.*)",
  ],
};
