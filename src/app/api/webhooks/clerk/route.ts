import { createClerkClient } from "@clerk/backend";
import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { buildPublicMetadataPatchAfterExternalAdminRoleRemoval } from "@/lib/admin-role-metadata";
import {
  extractBillingUserIdFromWebhookData,
  syncTeamSubscriberRoleMetadata,
} from "@/lib/team-clerk-metadata";
import { billingActivePlanSlug } from "@/lib/plan-metadata-billing-resolution";
import {
  upsertBillingInvoiceRecord,
  upsertBillingInvoicesFromSubscription,
} from "@/db/queries/billing";

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

function readString(
  value: unknown,
  fallback?: string | null,
): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback ?? null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }
  return null;
}

function readDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed) : null;
  }
  return null;
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
        const subscription = await clerkClient.billing.getUserBillingSubscription(userId);
        const planSlug = billingActivePlanSlug(subscription) ?? null;
        const user = await clerkClient.users.getUser(userId);
        const userEmail =
          user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase() ??
          null;

        const subscriptionAny = subscription as unknown as Record<string, unknown>;
        const rawInvoices = Array.isArray(subscriptionAny.invoices)
          ? subscriptionAny.invoices
          : [];
        await upsertBillingInvoicesFromSubscription(
          userId,
          userEmail,
          planSlug,
          rawInvoices as Parameters<typeof upsertBillingInvoicesFromSubscription>[3],
        );

        if (evt.type === "paymentAttempt.created" || evt.type === "paymentAttempt.updated") {
          const data = evt.data as Record<string, unknown>;
          const paymentAttemptId =
            readString(data.id) ??
            readString(data.payment_attempt_id) ??
            readString(data.paymentAttemptId) ??
            readString((data.payment_attempt as Record<string, unknown> | undefined)?.id);
          if (paymentAttemptId) {
            await upsertBillingInvoiceRecord({
              externalId: paymentAttemptId,
              source: "payment_attempt",
              userId,
              userEmail,
              planSlug,
              invoiceNumber:
                readString(data.invoice_number) ??
                readString(data.invoiceNumber) ??
                readString(data.number),
              status: readString(data.status, "unknown"),
              amountCents:
                readNumber(data.amount) ??
                readNumber(data.amount_due) ??
                readNumber(data.amountDue) ??
                readNumber(data.total),
              currency: readString(data.currency),
              hostedInvoiceUrl:
                readString(data.hosted_invoice_url) ??
                readString(data.hostedInvoiceUrl),
              invoicePdfUrl:
                readString(data.invoice_pdf) ??
                readString(data.invoicePdf),
              paidAt:
                readDate(data.created_at) ??
                readDate(data.createdAt) ??
                new Date(),
            });
          }
        }

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
