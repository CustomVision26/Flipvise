import { NextResponse } from "next/server";
import { revokeDeviceSyncToken } from "@/db/queries/device-sync-tokens";
import { resolveSyncUserId } from "@/lib/offline-api-auth";

/**
 * Revokes the device sync token presented in `Authorization: Bearer …`.
 * Called from the native WebView when the user signs out so clerk-handoff cannot
 * silently sign them back in.
 *
 *   POST    /api/native/revoke-sync-token
 *   OPTIONS /api/native/revoke-sync-token
 */

export const runtime = "nodejs";

const NATIVE_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);

function isNativeWebViewOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (NATIVE_ORIGINS.has(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return false;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "10.0.2.2"
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !isNativeWebViewOrigin(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
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

  const auth = request.headers.get("authorization") ?? "";
  const rawToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!rawToken) {
    return NextResponse.json(
      { error: "Missing bearer token" },
      { status: 400, headers: cors },
    );
  }

  await revokeDeviceSyncToken(rawToken);
  return NextResponse.json({ revoked: true }, { headers: cors });
}
