import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { generateCardsFromExtractedSource } from "@/actions/cards";
import type { SourceFormat } from "@/lib/source-import-formats";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  deckId: z.number().int().positive(),
  count: z.number().int().positive(),
  sourceText: z.string().min(1),
  sourceFormat: z.string().min(1),
  skipRelevanceCheck: z.boolean().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const result = await generateCardsFromExtractedSource(userId, {
      deckId: parsed.data.deckId,
      count: parsed.data.count,
      extracted: {
        text: parsed.data.sourceText,
        format: parsed.data.sourceFormat as SourceFormat,
      },
      skipRelevanceCheck: parsed.data.skipRelevanceCheck ?? false,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/decks/source-import/generate]", error);
    const message =
      error instanceof Error ? error.message : "Generation failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
