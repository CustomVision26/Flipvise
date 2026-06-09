import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import { generateAnswerBackImage } from "@/lib/generate-answer-back-image";

const bodySchema = z.object({
  deckId: z.number().int().positive(),
  question: z.string().min(1),
  answer: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const { userId, hasAI } = await getAccessContext();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { deckId, question, answer } = parsed.data;

  const bundle = await getDeckWithViewerAccess(deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const teamTierPro = await deckHasTeamTierProFeatures(bundle.deck);
  if (!(hasAI || teamTierPro)) {
    return NextResponse.json(
      { error: "AI answer generation requires a Pro plan." },
      { status: 403 },
    );
  }

  const image = await generateAnswerBackImage(bundle.deck, question, answer);
  if (!image) {
    return NextResponse.json(
      { error: "Image generation failed" },
      { status: 502 },
    );
  }

  return new Response(Buffer.from(image.data), {
    headers: {
      "Content-Type": image.mediaType,
      "Cache-Control": "no-store",
    },
  });
}
