"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { updateAffiliateQuotaSettings } from "@/db/queries/affiliates";
import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function requirePlatformAdminActor() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
}

const updateAffiliateQuotaSchema = z.object({
  affiliateId: z.number().int().positive(),
  enabled: z.boolean(),
  quotaTarget: z.number().int().min(1).max(10_000).optional(),
  resetPeriod: z.boolean().optional(),
});

export async function updateAffiliateQuotaSettingsAction(
  data: z.infer<typeof updateAffiliateQuotaSchema>,
) {
  await requirePlatformAdminActor();

  const parsed = updateAffiliateQuotaSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid quota settings.");
  }

  const { affiliateId, enabled, quotaTarget, resetPeriod } = parsed.data;
  if (enabled && (quotaTarget == null || quotaTarget < 1)) {
    throw new Error("Set a quota of at least 1 paid referral when enabling.");
  }

  const ok = await updateAffiliateQuotaSettings(affiliateId, {
    referralQuotaEnabled: enabled,
    referralQuotaTarget: enabled ? (quotaTarget ?? null) : null,
    resetPeriod: resetPeriod === true,
  });
  if (!ok) throw new Error("Affiliate not found.");

  revalidatePath("/admin/marketing-affiliates");
  revalidatePath("/dashboard/affiliate");
}
