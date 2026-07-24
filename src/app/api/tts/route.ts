import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { getAccessContext } from "@/lib/access";
import { resolveSyncUserId } from "@/lib/offline-api-auth";
import { resolveHasAiReadingForUserId } from "@/lib/offline-tts-access";

/**
 * Flashcard TTS.
 *
 * Auth: Clerk session (web) OR `Authorization: Bearer <device-sync-token>` (Capacitor).
 * Gated to Pro Plus / team-tier / platform admins (`hasAiReading`).
 */

export const runtime = "nodejs";

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

const bodySchema = z.object({
  text: z.string().min(1).max(4096),
  voice: z
    .enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"])
    .default("nova"),
});

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get("origin"));

  const userId = await resolveSyncUserId(req);
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: cors },
    );
  }

  const { userId: sessionUserId } = await auth();
  let hasAiReading = false;
  if (sessionUserId === userId) {
    hasAiReading = (await getAccessContext()).hasAiReading;
  } else {
    hasAiReading = await resolveHasAiReadingForUserId(userId);
  }

  if (!hasAiReading) {
    return NextResponse.json(
      { error: "Flashcard audio is available on Pro Plus and team plans." },
      { status: 403, headers: cors },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input" },
      { status: 400, headers: cors },
    );
  }

  const { text, voice } = parsed.data;

  const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "tts-1", voice, input: text }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.text().catch(() => "unknown");
    console.error("[TTS] OpenAI error:", err);
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 502, headers: cors },
    );
  }

  const audio = await openaiRes.arrayBuffer();
  return new Response(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      ...cors,
    },
  });
}
