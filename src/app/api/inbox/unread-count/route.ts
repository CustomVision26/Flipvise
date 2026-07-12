import { NextResponse } from "next/server";
import { auth } from "@/lib/clerk-auth";
import { getAccessContext } from "@/lib/access";
import { getInboxUnreadCountForUser } from "@/lib/inbox-unread-count";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getAccessContext();
  const count = await getInboxUnreadCountForUser({
    userId,
    primaryEmail: access.primaryEmail,
    isAdmin: access.isAdmin,
  });

  return NextResponse.json({ count });
}
