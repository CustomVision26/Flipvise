import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { buildPublicMetadataPatchAfterExternalAdminRoleRemoval } from "@/lib/admin-role-metadata";
import {
  extractBillingUserIdFromWebhookData,
  syncTeamSubscriberRoleMetadata,
} from "@/lib/team-clerk-metadata";

export const dynamic = "force-dynamic";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

type ClerkUserUpdatedData = {
  id?: string;
  public_metadata?: Record<string, unknown>;
};

type VerifiedClerkEvent = {
  type: string;
  data: unknown;
};

function isBillingSubscriptionEvent(type: string): boolean {
  return (
    type.startsWith("subscriptionItem.") ||
    type.startsWith("subscription.") ||
    type === "paymentAttempt.created" ||
    type === "paymentAttempt.updated"
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing CLERK_WEBHOOK_SECRET" }, { status: 503 });
  }

  const payload = await req.text();
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  let evt: VerifiedClerkEvent;
  try {
    const wh = new Webhook(secret);
    evt = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as VerifiedClerkEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (isBillingSubscriptionEvent(evt.type)) {
    const userId = extractBillingUserIdFromWebhookData(evt.data);
    if (userId) {
      try {
        await syncTeamSubscriberRoleMetadata(clerkClient, userId);
      } catch (err) {
        console.error("clerk webhook: team subscriber metadata sync failed", err);
        return NextResponse.json({ error: "Metadata sync failed" }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }

  if (evt.type !== "user.updated") {
    return NextResponse.json({ received: true });
  }

  const data = evt.data as ClerkUserUpdatedData;
  const userId = data?.id;
  if (!userId) {
    return NextResponse.json({ received: true });
  }

  const patch = buildPublicMetadataPatchAfterExternalAdminRoleRemoval(
    data.public_metadata,
  );
  if (!patch) {
    return NextResponse.json({ received: true });
  }

  try {
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: patch as Record<string, unknown>,
    });
  } catch (err) {
    console.error("clerk webhook: failed to repair metadata after admin role removal", err);
    return NextResponse.json({ error: "Metadata update failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
