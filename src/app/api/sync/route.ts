import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveUserIdByDeviceToken } from "@/db/queries/device-sync-tokens";
import {
  pullOfflineChanges,
  pushOfflineChanges,
  buildOfflineSyncContext,
} from "@/db/queries/offline-sync";

/**
 * Offline Study sync endpoint for the native (Capacitor) apps.
 *
 * This is an intentional API boundary for an EXTERNAL client (the bundled mobile app
 * cannot invoke Server Actions cross-origin). All database work is delegated to the
 * `offline-sync` query helper, and ownership is enforced from the resolved `userId` —
 * never from client-supplied ids.
 *
 * Auth: either a Clerk session cookie (same-origin live site) OR an
 * `Authorization: Bearer <device-sync-token>` header (bundled native app).
 *
 *   POST    /api/sync   { since, push }  ->  { idMap, pull }
 *   OPTIONS /api/sync                    -> CORS preflight
 */

export const runtime = "nodejs";

/** Origins the bundled Capacitor WebView uses. */
const NATIVE_ORIGINS = new Set([
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
  "https://localhost",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  // Only reflect known native WebView origins; same-origin web calls need no CORS.
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

/** Resolves the acting user from a Bearer device token, falling back to the Clerk session. */
async function resolveUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    const tokenUserId = await resolveUserIdByDeviceToken(token);
    if (tokenUserId) return tokenUserId;
  }
  const { userId } = await auth();
  return userId ?? null;
}

const pushDeckSchema = z.object({
  localId: z.string().min(1),
  serverId: z.number().int().nullable(),
  name: z.string().min(1).max(255),
  description: z.string().nullable(),
  gradient: z.string().nullable(),
  updatedAtMs: z.number().int().nonnegative(),
  deleted: z.boolean(),
  teamId: z.number().int().positive().nullable().optional(),
});

const pushCardSchema = z.object({
  localId: z.string().min(1),
  serverId: z.number().int().nullable(),
  deckLocalId: z.string().min(1),
  deckServerId: z.number().int().nullable(),
  front: z.string().nullable(),
  back: z.string().nullable(),
  cardType: z.enum(["standard", "multiple_choice"]),
  choices: z.array(z.string()).nullable(),
  correctChoiceIndex: z.number().int().nullable(),
  updatedAtMs: z.number().int().nonnegative(),
  deleted: z.boolean(),
});

const pushQuizResultSchema = z.object({
  localId: z.string().min(1),
  deckLocalId: z.string().min(1).nullable().optional(),
  deckServerId: z.number().int().nullable(),
  deckName: z.string().min(1).max(255),
  correct: z.number().int().nonnegative(),
  incorrect: z.number().int().nonnegative(),
  unanswered: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  percent: z.number().int().min(0).max(100),
  elapsedSeconds: z.number().int().nonnegative(),
  perCard: z.unknown().optional(),
});

const syncRequestSchema = z.object({
  since: z.number().int().nonnegative().default(0),
  fullPull: z.boolean().optional(),
  push: z
    .object({
      decks: z.array(pushDeckSchema).default([]),
      cards: z.array(pushCardSchema).default([]),
      quizResults: z.array(pushQuizResultSchema).default([]),
    })
    .default({ decks: [], cards: [], quizResults: [] }),
});

export async function POST(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));

  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 422, headers: cors },
    );
  }

  const { since, fullPull, push } = parsed.data;
  const effectiveSince = fullPull ? 0 : since;

  // Apply the client's offline changes first, then return everything newer than
  // `since` so the client converges to the server state in a single round-trip.
  const idMap = await pushOfflineChanges(userId, {
    decks: push.decks,
    cards: push.cards,
    quizResults: push.quizResults.map((q) => ({ ...q, perCard: q.perCard ?? null })),
  });

  const [pull, context] = await Promise.all([
    pullOfflineChanges(userId, effectiveSince),
    buildOfflineSyncContext(userId),
  ]);

  return NextResponse.json({ idMap, pull, context }, { headers: cors });
}
