import { NextResponse } from "next/server";
import {
  allowNativeShellRequest,
  nativeShellCorsHeaders,
} from "@/lib/native-api-request";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: nativeShellCorsHeaders(request.headers.get("origin")),
  });
}

/** Returns min/latest native store semver strings for update prompts. */
export async function GET(request: Request) {
  const cors = nativeShellCorsHeaders(request.headers.get("origin"));
  if (!allowNativeShellRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  return NextResponse.json(
    {
      android: {
        min: process.env.NATIVE_ANDROID_MIN_VERSION?.trim() || "1.0.0",
        latest: process.env.NATIVE_ANDROID_LATEST_VERSION?.trim() || "1.0.3",
      },
      ios: {
        min: process.env.NATIVE_IOS_MIN_VERSION?.trim() || "1.0.0",
        latest: process.env.NATIVE_IOS_LATEST_VERSION?.trim() || "1.0.3",
      },
      storeUrls: {
        android:
          process.env.NATIVE_ANDROID_STORE_URL?.trim() ||
          "https://play.google.com/store/apps/details?id=com.flipvise.app",
        ios:
          process.env.NATIVE_IOS_STORE_URL?.trim() ||
          "https://apps.apple.com/app/flipvise/id0000000000",
      },
    },
    { headers: cors },
  );
}
