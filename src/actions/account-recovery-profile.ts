"use server";

import { createClerkClient } from "@clerk/backend";
import { auth } from "@/lib/clerk-auth";
import { isAccountRecoveryProfileFullyComplete } from "@/lib/account-recovery-completeness";
import {
  accountRecoveryProfileSchema,
  buildAccountRecoveryPrivateMetadata,
  buildAccountRecoveryPublicMetadata,
  emptyAccountRecoveryFieldsValue,
  type AccountRecoveryFieldsValue,
  type AccountRecoveryProfileInput,
} from "@/lib/account-recovery-profile";
import { profileFieldsFromClerkMetadata } from "@/lib/account-recovery-form-helpers";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export type SaveAccountRecoveryProfileResult = {
  ok: true;
};

export async function saveAccountRecoveryProfileAction(
  data: AccountRecoveryProfileInput,
): Promise<SaveAccountRecoveryProfileResult> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const parsed = accountRecoveryProfileSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { mailingAddressSubdivisionError } = await import(
    "@/data/world-country-subdivisions"
  );
  const subdivisionError = await mailingAddressSubdivisionError(
    parsed.data.mailingAddress.country,
    parsed.data.mailingAddress.stateProvince,
  );
  if (subdivisionError) {
    throw new Error(subdivisionError);
  }

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: buildAccountRecoveryPublicMetadata(parsed.data),
    privateMetadata: buildAccountRecoveryPrivateMetadata(parsed.data),
  });

  try {
    const { syncStripeCustomerBillToForClerkUser } = await import(
      "@/lib/stripe-invoice-addresses"
    );
    await syncStripeCustomerBillToForClerkUser(userId);
  } catch (error) {
    console.error(
      "[saveAccountRecoveryProfileAction] sync Stripe Bill-to:",
      error,
    );
  }

  return { ok: true };
}

export async function getAccountRecoveryProfileStatusAction(): Promise<{
  complete: boolean;
}> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await clerkClient.users.getUser(userId);
  return {
    complete: await isAccountRecoveryProfileFullyComplete(
      user.publicMetadata as Record<string, unknown>,
      user.privateMetadata as Record<string, unknown>,
    ),
  };
}

/** Load editable account details (including private security Q&A) for the signed-in user. */
export async function getAccountRecoveryProfileForEditAction(): Promise<AccountRecoveryFieldsValue> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    return profileFieldsFromClerkMetadata(
      user.publicMetadata as Record<string, unknown>,
      user.privateMetadata as Record<string, unknown>,
    );
  } catch {
    return emptyAccountRecoveryFieldsValue();
  }
}
