import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";
import type { NextFetchEvent } from "next/server";
import {
  clearClerkCookiesOnResponse,
  isStaleOrMissingSessionError,
} from "@/lib/clerk-stale-session";

const clerk = clerkMiddleware();

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  requestHeaders.set("x-search", request.nextUrl.search);

  try {
    return await clerk(
      new NextRequest(request.url, { headers: requestHeaders }),
      event,
    );
  } catch (error) {
    if (isStaleOrMissingSessionError(error)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      const res = NextResponse.redirect(url);
      clearClerkCookiesOnResponse(request, res);
      return res;
    }
    throw error;
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
