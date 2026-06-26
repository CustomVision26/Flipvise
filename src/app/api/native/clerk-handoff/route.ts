import { NextResponse } from "next/server";
import { createClerkClient } from "@clerk/backend";
import { resolveSyncUserId } from "@/lib/offline-api-auth";

/**
 * Native → live-site sign-in handoff.
 *
 * The bundled native app holds a device sync token (a credential that already grants
 * access to the user's data via `/api/sync`). When it opens the live dashboard in the
 * system browser, it first calls this endpoint with that token to mint a short-lived
 * Clerk **sign-in token**. The browser is then sent to `/native-signin?ticket=…`, which
 * exchanges the ticket for a real Clerk session — so the dashboard lands signed-in
 * without forcing the user to type credentials inside a fragile WebView.
 *
 * Auth: `Authorization: Bearer <device-sync-token>` (same resolver as `/api/sync`).
 *
 *   POST    /api/native/clerk-handoff   -> { ticket }
 *   OPTIONS /api/native/clerk-handoff   -> CORS preflight
 */

export const runtime = "nodejs";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/** Origins the bundled Capacitor WebView uses. */
const NATIVE_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && NATIVE_ORIGINS.has(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
  }
  return {};
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));

  const userId = await resolveSyncUserId(request);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: cors },
    );
  }

  try {
    const signInToken = await clerkClient.signInTokens.createSignInToken({
      userId,
      // Short-lived: the token is consumed immediately by the browser tab.
      expiresInSeconds: 120,
    });
    return NextResponse.json({ ticket: signInToken.token }, { headers: cors });
  } catch {
    return NextResponse.json(
      { error: "Could not create sign-in handoff." },
      { status: 502, headers: cors },
    );
  }
}
