"use server";

import { auth, currentUser } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { reverificationError } from "@clerk/nextjs/server";
import { z } from "zod";
import { getActiveStripeSubscription } from "@/db/queries/stripe-subscriptions";
import { purgeAllUserData } from "@/db/queries/user-deletion";
import { estimateProratedRefundForSubscription } from "@/lib/stripe-account-deletion";
import { recordDeletionProrationAndCancel } from "@/lib/account-deletion-proration-ledger";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { loopsDeleteContact } from "@/lib/loops";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/** Require fresh first-factor credentials before permanent account deletion. */
const DELETE_ACCOUNT_REVERIFICATION = {
  level: "first_factor",
  afterMinutes: 1,
} as const;

const deleteAccountSchema = z.object({
  confirmPhrase: z
    .string()
    .trim()
    .refine((v) => v === "DELETE", { message: 'Type "DELETE" to confirm.' }),
});

export type AccountDeletionPreview = {
  hasPaidSubscription: boolean;
  planLabel: string | null;
  refundCents: number;
  currency: string;
};

export async function getAccountDeletionPreviewAction(): Promise<AccountDeletionPreview> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const sub = await getActiveStripeSubscription(userId);
  if (!sub) {
    return {
      hasPaidSubscription: false,
      planLabel: null,
      refundCents: 0,
      currency: "usd",
    };
  }

  const estimate = await estimateProratedRefundForSubscription(
    sub.stripeSubscriptionId,
    sub.planSlug,
  );

  return {
    hasPaidSubscription: true,
    planLabel: sub.planSlug
      ? displayNameForBillingPlanSlug(sub.planSlug)
      : "Paid",
    refundCents: estimate?.refundCents ?? 0,
    currency: estimate?.currency ?? "usd",
  };
}

export type DeleteAccountResult = {
  refundCents: number;
  currency: string;
};

export async function deleteAccountAction(
  data: z.infer<typeof deleteAccountSchema>,
): Promise<DeleteAccountResult | ReturnType<typeof reverificationError>> {
  const parsed = deleteAccountSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { userId, has } = await auth();
  if (!userId) throw new Error("Unauthorized");

  if (!has({ reverification: DELETE_ACCOUNT_REVERIFICATION })) {
    return reverificationError(DELETE_ACCOUNT_REVERIFICATION);
  }

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() ??
    user?.emailAddresses[0]?.emailAddress?.toLowerCase() ??
    null;

  let refundCents = 0;
  let currency = "usd";

  const activeSub = await getActiveStripeSubscription(userId);
  if (activeSub) {
    const displayName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      user?.username ||
      null;
    const refund = await recordDeletionProrationAndCancel({
      clerkUserId: userId,
      stripeCustomerId: activeSub.stripeCustomerId,
      stripeSubscriptionId: activeSub.stripeSubscriptionId,
      planSlug: activeSub.planSlug,
      subscriptionPeriodEnd: activeSub.currentPeriodEnd,
      userSnapshot: {
        email,
        displayName,
      },
    });
    refundCents = refund.refundCents;
    currency = refund.currency;
  }

  await purgeAllUserData(userId, { skipStripeCancellation: true });

  if (email) {
    void loopsDeleteContact(email);
  }

  await clerkClient.users.deleteUser(userId);

  return { refundCents, currency };
}
