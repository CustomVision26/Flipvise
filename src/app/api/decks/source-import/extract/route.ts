import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAccessContext } from "@/lib/access";
import { canUseAdvancedSourceImport } from "@/lib/source-import-access";
import { canUseDeckAiFeatures, DECK_AI_PLAN_REQUIREMENT } from "@/lib/deck-ai-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const access = await getAccessContext();
    const { hasAiReading } = access;

    const formData = await req.formData();
    const deckId = Number(formData.get("deckId"));
    const file = formData.get("file");
    if (!Number.isInteger(deckId) || deckId <= 0) {
      return NextResponse.json({ error: "Invalid deck." }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Choose a PDF or other document file to import." },
        { status: 400 },
      );
    }

    const bundle = await getDeckWithViewerAccess(deckId, userId);
    if (!bundle || !canEditDeckContent(bundle.access)) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const teamTierPro = await deckHasTeamTierProFeatures(bundle.deck);
    if (!canUseDeckAiFeatures(access, teamTierPro)) {
      return NextResponse.json({ error: DECK_AI_PLAN_REQUIREMENT }, { status: 403 });
    }

    const advancedImport = canUseAdvancedSourceImport({
      hasAiReading,
      teamTierProWorkspace: teamTierPro,
    });

    const {
      assertFormatAllowedForPlan,
      extractTextFromFile,
      resolveFileSourceFormat,
    } = await import("@/lib/document-extract");

    const format = resolveFileSourceFormat(file);
    assertFormatAllowedForPlan(format, advancedImport);

    const extracted = await extractTextFromFile(file);
    return NextResponse.json({ text: extracted.text, format: extracted.format });
  } catch (error) {
    console.error("[api/decks/source-import/extract]", error);
    const message =
      error instanceof Error ? error.message : "Could not read the file. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
