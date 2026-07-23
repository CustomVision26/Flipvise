"use server";

import { reverificationError } from "@clerk/nextjs/server";
import { auth } from "@/lib/clerk-auth";

/** Require fresh first-factor credentials before editing account recovery details. */
const EDIT_ACCOUNT_DETAILS_REVERIFICATION = {
  level: "first_factor",
  afterMinutes: 10,
} as const;

export type UnlockAccountDetailsEditResult = {
  ok: true;
};

/**
 * Step-up auth gate for Account Details → Edit. Kept in a lean module so the
 * Clerk header custom page does not pull heavy account-recovery dependencies
 * into the client action proxy graph.
 */
export async function unlockAccountDetailsEditAction(): Promise<
  UnlockAccountDetailsEditResult | ReturnType<typeof reverificationError>
> {
  const { userId, has } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  if (!has({ reverification: EDIT_ACCOUNT_DETAILS_REVERIFICATION })) {
    return reverificationError(EDIT_ACCOUNT_DETAILS_REVERIFICATION);
  }

  return { ok: true };
}
