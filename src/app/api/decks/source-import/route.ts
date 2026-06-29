import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateCardsFromSourceAction } from "@/actions/cards";

export const runtime = "nodejs";
/** PDF extract + two OpenAI calls can exceed default platform timeouts. */
export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Choose a PDF or other document file to import." },
        { status: 400 },
      );
    }

    const result = await generateCardsFromSourceAction(formData);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/decks/source-import]", error);
    const message =
      error instanceof Error ? error.message : "Generation failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
