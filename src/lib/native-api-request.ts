import { NextResponse } from "next/server";
import { detectNativeShellFromUserAgent } from "@/lib/native-shell-from-request";

export function allowNativeShellRequest(request: Request): boolean {
  const ua = request.headers.get("user-agent") ?? "";
  if (detectNativeShellFromUserAgent(ua).isNativeShell) {
    return true;
  }
  return request.headers.get("x-flipvise-native-shell") === "1";
}

export function nativeShellCorsHeaders(origin: string | null): Record<string, string> {
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
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
