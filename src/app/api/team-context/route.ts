import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  clearTeamContextCookie,
  syncTeamContextCookieForUser,
} from "@/lib/team-context-cookie-server";

function safeSameOriginRedirectPath(
  redirect: string | null,
  origin: string,
): string {
  const fallback = "/dashboard";
  if (!redirect?.trim()) return fallback;
  const trimmed = redirect.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  try {
    const url = new URL(trimmed, origin);
    if (url.origin !== origin) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/** Sets or clears the team workspace cookie, then redirects (Server Component-safe). */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }

  const action = request.nextUrl.searchParams.get("action");
  const teamIdRaw = request.nextUrl.searchParams.get("teamId");
  const redirectPath = safeSameOriginRedirectPath(
    request.nextUrl.searchParams.get("redirect"),
    request.nextUrl.origin,
  );

  if (action === "clear") {
    await clearTeamContextCookie();
  } else if (action === "sync") {
    const teamId = Number(teamIdRaw);
    if (!Number.isFinite(teamId) || teamId <= 0) {
      return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
    }
    await syncTeamContextCookieForUser(teamId, userId);
  }

  return NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin));
}
