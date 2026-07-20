import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { canUseDeckAiFeatures, DECK_AI_PLAN_REQUIREMENT } from "@/lib/deck-ai-access";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import {
  isRenderableMathDiagram,
  normalizeMathDiagram,
  parseMathDiagramAi,
  renderMathDiagramToSvg,
} from "@/lib/math-diagrams";

const bodySchema = z.object({
  deckId: z.number().int().positive(),
  diagram: z.unknown(),
});

/**
 * Renders a structured math diagram to SVG.
 * Clients rasterize to PNG before uploading as a card image.
 */
export async function POST(req: NextRequest) {
  const access = await getAccessContext();
  if (!access.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { deckId, diagram: rawDiagram } = parsed.data;

  const bundle = await getDeckWithViewerAccess(deckId, access.userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const teamTierPro = await deckHasTeamTierProFeatures(bundle.deck);
  if (!canUseDeckAiFeatures(access, teamTierPro)) {
    return NextResponse.json({ error: DECK_AI_PLAN_REQUIREMENT }, { status: 403 });
  }

  const parsedDiagram = parseMathDiagramAi(rawDiagram);
  if (!isRenderableMathDiagram(parsedDiagram)) {
    return NextResponse.json({ error: "No diagram to render" }, { status: 422 });
  }

  const diagram = normalizeMathDiagram(parsedDiagram);
  if (!diagram) {
    return NextResponse.json({ error: "Invalid diagram" }, { status: 422 });
  }

  const svg = renderMathDiagramToSvg(diagram);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Diagram-Side": diagram.side,
      "X-Diagram-Type": diagram.type,
    },
  });
}
