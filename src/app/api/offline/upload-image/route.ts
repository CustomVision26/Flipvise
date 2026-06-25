import { NextResponse } from "next/server";
import { z } from "zod";
import { IMAGE_ALLOWED_TYPES, IMAGE_MAX_BYTES } from "@/lib/image-file";
import { uploadToS3 } from "@/lib/s3";
import { resolveSyncUserId } from "@/lib/offline-api-auth";
import { db } from "@/db";
import { decks } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

const uploadSchema = z.object({
  deckServerId: z.coerce.number().int().positive(),
});

export async function POST(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));

  const userId = await resolveSyncUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400, headers: cors });
  }

  const parsed = uploadSchema.safeParse({
    deckServerId: formData.get("deckServerId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deck id" }, { status: 422, headers: cors });
  }

  const owned = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, parsed.data.deckServerId), eq(decks.userId, userId)))
    .limit(1);
  if (owned.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: cors });
  }

  const file = formData.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided" }, { status: 400, headers: cors });
  }

  if (!IMAGE_ALLOWED_TYPES.includes(file.type as (typeof IMAGE_ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, and GIF images are allowed" },
      { status: 400, headers: cors },
    );
  }

  if (file.size > IMAGE_MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 5 MB" }, { status: 400, headers: cors });
  }

  try {
    const url = await uploadToS3({
      userId,
      deckId: parsed.data.deckServerId,
      file,
      addRandomSuffix: true,
    });
    return NextResponse.json({ url }, { headers: cors });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500, headers: cors });
  }
}
