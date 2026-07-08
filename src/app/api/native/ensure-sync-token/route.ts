import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk-auth";
import { createDeviceSyncToken } from "@/db/queries/device-sync-tokens";
import { detectNativeShellFromUserAgent } from "@/lib/native-shell-from-request";

export const runtime = "nodejs";

function allowNativeSyncTokenRequest(request: Request): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (detectNativeShellFromUserAgent(ua).isNativeShell) {
    return true;
  }
  // Set by NativeAppBootstrap only when isFlipviseNativeShell() (Capacitor bridge or UA marker).
  return request.headers.get("x-flipvise-native-shell") === "1";
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== "http:" && protocol !== "https:") return {};
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "10.0.2.2"
    ) {
      return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Flipvise-Native-Shell",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      };
    }
  } catch {
    // ignore
  }
  return {};
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

/**
 * Mint a device sync token for the signed-in native WebView session so the next
 * "Online Dashboard" tap can use ticket handoff without "Make available offline".
 */
export async function POST(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));
  if (!allowNativeSyncTokenRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  try {
    const token = await createDeviceSyncToken(userId, "native-auto");
    return NextResponse.json({ token }, { headers: cors });
  } catch {
    return NextResponse.json(
      { error: "Could not create sync token." },
      { status: 502, headers: cors },
    );
  }
}
