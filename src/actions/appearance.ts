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
  BACKGROUND_CHANGE_HOURS_MAX,
  BACKGROUND_CHANGE_HOURS_MIN,
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
    backgroundChangeEnabled: z.boolean().optional(),
    backgroundChangeHours: z
      .number()
      .int()
      .min(BACKGROUND_CHANGE_HOURS_MIN)
      .max(BACKGROUND_CHANGE_HOURS_MAX)
      .optional(),
  })
  .refine(
    (value) =>
      value.illustratedDesignPreferred !== undefined ||
      value.reduceAnimations !== undefined ||
      value.backgroundChangeEnabled !== undefined ||
      value.backgroundChangeHours !== undefined,
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
): Promise<
  | { ok: true; snapshot: Awaited<ReturnType<typeof getAppearanceSnapshot>> }
  | { ok: false; error: string }
> {
  noStore();
  try {
    const access = await getAccessContext();
    const { userId } = access;
    if (!userId || !canUpdateUserAppearance(userId, userId)) {
      return { ok: false, error: "Sign in to save appearance settings." };
    }

    const parsed = userPatchSchema.safeParse(data);
    if (!parsed.success) {
      return { ok: false, error: "Invalid appearance settings." };
    }

    const snapshot = await updateCurrentUserAppearancePreferences(
      userId,
      {
        illustratedDesignPreferred: parsed.data.illustratedDesignPreferred,
        reduceAnimations: parsed.data.reduceAnimations,
        backgroundChangeEnabled: parsed.data.backgroundChangeEnabled,
        backgroundChangeHours: parsed.data.backgroundChangeHours,
      },
      resolvePlanSlugForAddonEligibility(access),
    );
    // The client applies the saved snapshot immediately. Revalidating the root
    // layout from this action re-renders the page behind the account modal and
    // surfaces an opaque Server Components digest when that render fails.
    return { ok: true, snapshot };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (
      message.includes("Failed query") ||
      message.includes("does not exist") ||
      message.includes("user_appearance_preferences")
    ) {
      return {
        ok: false,
        error: "Appearance settings could not be saved. The standard design stays on.",
      };
    }
    return {
      ok: false,
      error: "Could not save appearance settings.",
    };
  }
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
  try {
    revalidatePath("/", "layout");
    revalidatePath("/admin/feature-controls");
  } catch {
    // The setting is already stored. A failed refresh must not fail the save.
  }
  return saved;
}
