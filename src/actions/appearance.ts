"use server";

import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { resolvePlanSlugForAddonEligibility } from "@/lib/addon-plan-eligibility";
import {
  getAdminAppearanceSettings,
  getAppearanceSnapshot,
  updateAdminAppearanceSettings,
  updateCurrentUserAppearancePreferences,
} from "@/db/queries/appearance";
import {
  canUpdateGlobalAppearance,
  canUpdateUserAppearance,
} from "@/lib/illustrated-appearance";
import { getClerkPublicActorNameById } from "@/lib/clerk-user-display";
import type { AdminAppearanceSettings } from "@/db/queries/appearance";

async function withUpdatedByLabel(settings: AdminAppearanceSettings) {
  const updatedByLabel = settings.updatedByUserId
    ? await getClerkPublicActorNameById(settings.updatedByUserId)
    : null;
  return {
    illustratedDesignEnabled: settings.illustratedDesignEnabled,
    updatedAt: settings.updatedAt,
    updatedByLabel,
  };
}

const userPatchSchema = z
  .object({
    illustratedDesignPreferred: z.boolean().optional(),
    reduceAnimations: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.illustratedDesignPreferred !== undefined ||
      value.reduceAnimations !== undefined,
    { message: "No appearance fields submitted." },
  );

const adminPatchSchema = z.object({
  illustratedDesignEnabled: z.boolean(),
});

export async function getAppearanceSnapshotAction() {
  noStore();
  const access = await getAccessContext();
  return getAppearanceSnapshot(
    access.userId,
    resolvePlanSlugForAddonEligibility(access),
  );
}

export async function updateCurrentUserAppearancePreferencesAction(
  data: z.infer<typeof userPatchSchema>,
) {
  noStore();
  const access = await getAccessContext();
  const { userId } = access;
  if (!userId || !canUpdateUserAppearance(userId, userId)) {
    throw new Error("Unauthorized");
  }

  const parsed = userPatchSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid appearance settings.");

  const saved = await updateCurrentUserAppearancePreferences(
    userId,
    {
      illustratedDesignPreferred: parsed.data.illustratedDesignPreferred,
      reduceAnimations: parsed.data.reduceAnimations,
    },
    resolvePlanSlugForAddonEligibility(access),
  );
  revalidatePath("/", "layout");
  return saved;
}

export async function getAdminAppearanceSettingsAction() {
  noStore();
  const { userId, isAdmin } = await getAccessContext();
  if (!userId || !canUpdateGlobalAppearance(isAdmin)) {
    throw new Error("Forbidden");
  }
  return withUpdatedByLabel(await getAdminAppearanceSettings());
}

export async function updateAdminAppearanceSettingsAction(
  data: z.infer<typeof adminPatchSchema>,
) {
  noStore();
  const { userId, isAdmin } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");
  if (!canUpdateGlobalAppearance(isAdmin)) throw new Error("Forbidden");

  const parsed = adminPatchSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid appearance settings.");

  const saved = await withUpdatedByLabel(
    await updateAdminAppearanceSettings(userId, parsed.data.illustratedDesignEnabled),
  );
  revalidatePath("/", "layout");
  revalidatePath("/admin/feature-controls");
  return saved;
}
