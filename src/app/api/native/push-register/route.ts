import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/clerk-auth";
import {
  allowNativeShellRequest,
  nativeShellCorsHeaders,
} from "@/lib/native-api-request";
import {
  revokeAllNativePushTokensForUser,
  revokeNativePushToken,
  upsertNativePushToken,
  type NativePushPlatform,
} from "@/db/queries/native-push-tokens";

export const runtime = "nodejs";

const registerSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(["android", "ios"]),
  appVersion: z.string().max(32).optional(),
});

const revokeSchema = z.object({
  token: z.string().min(1).max(512).optional(),
});

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: nativeShellCorsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const cors = nativeShellCorsHeaders(request.headers.get("origin"));
  if (!allowNativeShellRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400, headers: cors });
  }

  try {
    await upsertNativePushToken({
      userId,
      token: parsed.data.token,
      platform: parsed.data.platform as NativePushPlatform,
      appVersion: parsed.data.appVersion ?? null,
      label: "native-app",
    });
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch {
    return NextResponse.json(
      { error: "Could not register push token." },
      { status: 502, headers: cors },
    );
  }
}

export async function DELETE(request: Request) {
  const cors = nativeShellCorsHeaders(request.headers.get("origin"));
  if (!allowNativeShellRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  let token: string | undefined;
  try {
    const body = await request.json();
    const parsed = revokeSchema.safeParse(body);
    token = parsed.success ? parsed.data.token : undefined;
  } catch {
    // No body — revoke all tokens for user.
  }

  try {
    if (token) {
      await revokeNativePushToken(token);
    } else {
      await revokeAllNativePushTokensForUser(userId);
    }
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch {
    return NextResponse.json(
      { error: "Could not revoke push token." },
      { status: 502, headers: cors },
    );
  }
}
