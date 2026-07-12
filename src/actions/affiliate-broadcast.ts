"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import { promises as fs } from "fs";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import type { PlanConfig } from "@/components/pricing-content";
import { plansConfigFilePath } from "@/lib/plans-config-disk";
import {
  listActiveAffiliatesForBroadcast,
} from "@/db/queries/affiliates";
import {
  insertAffiliateBroadcastInboxMessage,
  type AffiliateBroadcastVariant,
} from "@/db/queries/affiliate-broadcast-inbox";
import { resolveAppUrl } from "@/lib/stripe";
import {
  buildAffiliateCombinedDetailsBlock,
  buildGeneralPromoDetailsBlock,
  listPlansWithGeneralDiscount,
  listPlansEligibleForAffiliateCodeBroadcast,
} from "@/lib/affiliate-broadcast-messaging";
import { notifyNativeInboxPush } from "@/lib/notify-native-inbox-push";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function listAllClerkUserIds(): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  const limit = 500;
  const maxUsers = 100_000;
  for (;;) {
    const res = await clerkClient.users.getUserList({
      limit,
      offset,
    });
    for (const u of res.data) {
      ids.push(u.id);
    }
    if (res.data.length < limit) break;
    offset += limit;
    if (offset >= maxUsers) {
      throw new Error(
        `Broadcast aborted: more than ${maxUsers} Clerk users — contact engineering to batch sends.`,
      );
    }
  }
  return ids;
}

async function deliverGeneralPromoToClerkUsers(opts: {
  variant: AffiliateBroadcastVariant;
  clerkUserIds: string[];
  subject: string;
  message: string;
  detailsBlock: string;
  pricingPageUrl: string;
}): Promise<number> {
  let inboxDelivered = 0;
  for (const recipientUserId of opts.clerkUserIds) {
    const id = await insertAffiliateBroadcastInboxMessage({
      recipientUserId,
      variant: opts.variant,
      subject: opts.subject,
      messageBody: opts.message,
      detailsBlock: opts.detailsBlock,
      pricingPageUrl: opts.pricingPageUrl,
    });
    if (id != null) inboxDelivered++;
    notifyNativeInboxPush({
      recipientUserId,
      category: "affiliate_broadcast",
      body: opts.subject,
    });
  }
  return inboxDelivered;
}

async function resolveAffiliateClerkRecipientId(
  invitedUserId: string | null | undefined,
  invitedEmail: string,
): Promise<string | null> {
  const uid = invitedUserId?.trim();
  if (uid) return uid;
  const email = invitedEmail.trim().toLowerCase();
  if (!email) return null;
  try {
    const result = await clerkClient.users.getUserList({
      emailAddress: [email],
      limit: 1,
    });
    return result.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function requirePlatformAdminActor() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
}

async function readPlans(): Promise<PlanConfig[]> {
  const raw = await fs.readFile(plansConfigFilePath(), "utf-8");
  return JSON.parse(raw) as PlanConfig[];
}

const selectedPlanIdsSchema = z
  .array(z.string().min(1).max(64))
  .min(1, "Select at least one plan.")
  .max(32);

const generalPromoBroadcastSchema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(1).max(8000),
  selectedPlanIds: selectedPlanIdsSchema,
});

export type GeneralPromoBroadcastInput = z.infer<typeof generalPromoBroadcastSchema>;

const codesBroadcastSchema = z
  .object({
    subject: z.string().min(3).max(200),
    message: z.string().min(1).max(8000),
    selectedPlanIds: selectedPlanIdsSchema,
    recipientMode: z.enum(["all_active", "selected"]),
    selectedAffiliateIds: z.array(z.number().int().positive()).max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.recipientMode !== "selected") return;
    if ((data.selectedAffiliateIds?.length ?? 0) === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one affiliate.",
        path: ["selectedAffiliateIds"],
      });
    }
  });

export type AffiliateCodesBroadcastInput = z.infer<typeof codesBroadcastSchema>;

function assertAtLeastOneInboxDelivery(inboxDelivered: number) {
  if (inboxDelivered > 0) return;
  throw new Error(
    "No inbox messages were delivered. Affiliates must use an invite email that matches a Flipvise (Clerk) account. Others cannot receive this broadcast.",
  );
}

function assertSelectedPlansEligible(plans: PlanConfig[], selectedPlanIds: string[]) {
  const eligibleIds = new Set(listPlansWithGeneralDiscount(plans).map((p) => p.id));
  const invalid = selectedPlanIds.filter((id) => !eligibleIds.has(id));
  if (invalid.length > 0) {
    throw new Error("One or more selected plans no longer have an active general discount.");
  }
}

function assertSelectedPlansAffiliateBroadcastEligible(
  plans: PlanConfig[],
  selectedPlanIds: string[],
) {
  if (selectedPlanIds.length === 0) {
    throw new Error("Select at least one plan.");
  }

  const eligibleIds = new Set(listPlansEligibleForAffiliateCodeBroadcast(plans).map((p) => p.id));
  const invalid = selectedPlanIds.filter((id) => !eligibleIds.has(id));
  if (invalid.length > 0) {
    throw new Error(
      "Every selected plan must have general discount and affiliate discount turned on (with a Stripe coupon id).",
    );
  }
}

function assertGeneralPromoDelivered(inboxDelivered: number) {
  if (inboxDelivered > 0) return;
  throw new Error(
    "No inbox messages were delivered — your Clerk project returned no user ids or every insert failed.",
  );
}

export async function broadcastAffiliateGeneralPromoAction(
  data: GeneralPromoBroadcastInput,
): Promise<{ sent: number; inboxDelivered: number }> {
  await requirePlatformAdminActor();

  const parsed = generalPromoBroadcastSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { subject, message, selectedPlanIds } = parsed.data;

  const plans = await readPlans();
  assertSelectedPlansEligible(plans, selectedPlanIds);
  const promoDetails = buildGeneralPromoDetailsBlock(plans, selectedPlanIds);
  const base = resolveAppUrl();
  const pricingPageUrl = `${base}/pricing`;

  const clerkUserIds = await listAllClerkUserIds();
  if (clerkUserIds.length === 0) {
    throw new Error("No Clerk users found — nothing to send.");
  }

  const sent = clerkUserIds.length;
  const inboxDelivered = await deliverGeneralPromoToClerkUsers({
    variant: "general",
    clerkUserIds,
    subject,
    message,
    detailsBlock: promoDetails,
    pricingPageUrl,
  });

  assertGeneralPromoDelivered(inboxDelivered);

  revalidatePath("/admin/plans");
  revalidatePath("/admin/affiliate-messaging");
  revalidatePath("/dashboard/inbox");
  return { sent, inboxDelivered };
}

export async function broadcastAffiliateCodesAction(
  data: AffiliateCodesBroadcastInput,
): Promise<{ sent: number; inboxDelivered: number }> {
  await requirePlatformAdminActor();

  const parsed = codesBroadcastSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { subject, message, selectedPlanIds, recipientMode, selectedAffiliateIds } = parsed.data;
  const recipients = await listActiveAffiliatesForBroadcast(
    recipientMode === "selected"
      ? { affiliateIds: selectedAffiliateIds }
      : undefined,
  );

  if (recipients.length === 0) {
    throw new Error(
      recipientMode === "selected"
        ? "No active affiliates match your selection. Refresh the page and try again."
        : "No active affiliates match this send.",
    );
  }

  const plans = await readPlans();
  assertSelectedPlansAffiliateBroadcastEligible(plans, selectedPlanIds);
  const base = resolveAppUrl();
  const pricingPageUrl = `${base}/pricing`;

  let inboxDelivered = 0;
  for (const r of recipients) {
    const combinedCodeHints = buildAffiliateCombinedDetailsBlock(
      plans,
      r.promotionalCode,
      selectedPlanIds,
    );

    const clerkId = await resolveAffiliateClerkRecipientId(r.invitedUserId, r.invitedEmail);
    if (!clerkId) continue;
    const inserted = await insertAffiliateBroadcastInboxMessage({
      recipientUserId: clerkId,
      variant: "codes",
      subject,
      messageBody: message,
      detailsBlock: combinedCodeHints,
      pricingPageUrl,
    });
    if (inserted != null) inboxDelivered++;
    notifyNativeInboxPush({
      recipientUserId: clerkId,
      category: "affiliate_broadcast",
      body: subject,
    });
  }

  assertAtLeastOneInboxDelivery(inboxDelivered);

  revalidatePath("/admin/plans");
  revalidatePath("/admin/affiliate-messaging");
  revalidatePath("/dashboard/inbox");
  return { sent: recipients.length, inboxDelivered };
}
