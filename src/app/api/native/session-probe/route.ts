import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk-auth";

export const runtime = "nodejs";

/**
 * Lightweight check: does the Next server see a Clerk session for this request?
 * Used by `/native-signin` to avoid redirect loops when Clerk JS is ahead of cookies.
 */
export async function GET() {
  const { userId } = await auth();
  return NextResponse.json(
    { signedIn: Boolean(userId) },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
