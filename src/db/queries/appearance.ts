import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  platformAppearanceAuditLogs,
  platformAppearanceSettings,
  userAppearancePreferences,
} from "@/db/schema";
import {
  ILLUSTRATED_DESIGN_AUDIT_ACTION,
  clampBackgroundChangeHours,
  coalesceGlobalAppearance,
  coalesceUserAppearance,
  planAllowsIllustratedDesign,
  type PublicAppearanceSnapshot,
} from "@/lib/illustrated-appearance";

const SETTINGS_ID = 1;

export type AdminAppearanceSettings = {
  illustratedDesignEnabled: boolean;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

export async function getPublicAppearanceAvailability(): Promise<{
  illustratedDesignEnabled: boolean;
}> {
  const rows = await db
    .select({
      illustratedDesignEnabled: platformAppearanceSettings.illustratedDesignEnabled,
    })
    .from(platformAppearanceSettings)
    .where(eq(platformAppearanceSettings.id, SETTINGS_ID))
    .limit(1);

  return {
    illustratedDesignEnabled: coalesceGlobalAppearance(rows[0]),
  };
}

export async function getCurrentUserAppearancePreferences(userId: string): Promise<{
  illustratedDesignPreferred: boolean;
  reduceAnimations: boolean;
  backgroundChangeEnabled: boolean;
  backgroundChangeHours: number;
  backgroundRotationStartedAt: string | null;
}> {
  const rows = await db
    .select({
      illustratedDesignPreferred: userAppearancePreferences.illustratedDesignPreferred,
      reduceAnimations: userAppearancePreferences.reduceAnimations,
      backgroundChangeEnabled: userAppearancePreferences.backgroundChangeEnabled,
      backgroundChangeHours: userAppearancePreferences.backgroundChangeHours,
      backgroundRotationStartedAt: userAppearancePreferences.backgroundRotationStartedAt,
    })
    .from(userAppearancePreferences)
    .where(eq(userAppearancePreferences.userId, userId))
    .limit(1);

  return coalesceUserAppearance(rows[0]);
}

export async function getAppearanceSnapshot(
  userId: string | null,
  planSlug: string | null,
): Promise<PublicAppearanceSnapshot> {
  const global = await getPublicAppearanceAvailability();
  const planAllowsIllustrated = planAllowsIllustratedDesign(planSlug);
  if (!userId) {
    return {
      userId: null,
      globalEnabled: global.illustratedDesignEnabled,
      userPreferred: false,
      userReduceAnimations: false,
      planAllowsIllustrated: false,
      backgroundChangeEnabled: false,
      backgroundChangeHours: 24,
      backgroundRotationStartedAt: null,
    };
  }
  const user = await getCurrentUserAppearancePreferences(userId);
  return {
    userId,
    globalEnabled: global.illustratedDesignEnabled,
    userPreferred: user.illustratedDesignPreferred,
    userReduceAnimations: user.reduceAnimations,
    planAllowsIllustrated,
    backgroundChangeEnabled: user.backgroundChangeEnabled,
    backgroundChangeHours: user.backgroundChangeHours,
    backgroundRotationStartedAt: user.backgroundRotationStartedAt,
  };
}

export async function updateCurrentUserAppearancePreferences(
  userId: string,
  patch: {
    illustratedDesignPreferred?: boolean;
    reduceAnimations?: boolean;
    backgroundChangeEnabled?: boolean;
    backgroundChangeHours?: number;
  },
  planSlug: string | null,
): Promise<PublicAppearanceSnapshot> {
  const existing = await getCurrentUserAppearancePreferences(userId);
  const illustratedDesignPreferred =
    patch.illustratedDesignPreferred ?? existing.illustratedDesignPreferred;
  const reduceAnimations = patch.reduceAnimations ?? existing.reduceAnimations;
  const backgroundChangeEnabled =
    patch.backgroundChangeEnabled ?? existing.backgroundChangeEnabled;
  const backgroundChangeHours = clampBackgroundChangeHours(
    patch.backgroundChangeHours ?? existing.backgroundChangeHours,
  );
  const resetsClock =
    patch.backgroundChangeEnabled !== undefined ||
    patch.backgroundChangeHours !== undefined;
  const updatedAt = new Date();
  const backgroundRotationStartedAt = resetsClock
    ? updatedAt
    : existing.backgroundRotationStartedAt
      ? new Date(existing.backgroundRotationStartedAt)
      : updatedAt;

  await db
    .insert(userAppearancePreferences)
    .values({
      userId,
      illustratedDesignPreferred,
      reduceAnimations,
      backgroundChangeEnabled,
      backgroundChangeHours,
      backgroundRotationStartedAt,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: userAppearancePreferences.userId,
      set: {
        ...(patch.illustratedDesignPreferred !== undefined
          ? { illustratedDesignPreferred: patch.illustratedDesignPreferred }
          : {}),
        ...(patch.reduceAnimations !== undefined
          ? { reduceAnimations: patch.reduceAnimations }
          : {}),
        ...(patch.backgroundChangeEnabled !== undefined
          ? { backgroundChangeEnabled: patch.backgroundChangeEnabled }
          : {}),
        ...(patch.backgroundChangeHours !== undefined
          ? { backgroundChangeHours }
          : {}),
        ...(resetsClock ? { backgroundRotationStartedAt } : {}),
        updatedAt,
      },
    });

  return getAppearanceSnapshot(userId, planSlug);
}

export async function getAdminAppearanceSettings(): Promise<AdminAppearanceSettings> {
  const rows = await db
    .select({
      illustratedDesignEnabled: platformAppearanceSettings.illustratedDesignEnabled,
      updatedAt: platformAppearanceSettings.updatedAt,
      updatedByUserId: platformAppearanceSettings.updatedByUserId,
    })
    .from(platformAppearanceSettings)
    .where(eq(platformAppearanceSettings.id, SETTINGS_ID))
    .limit(1);

  const row = rows[0];
  return {
    illustratedDesignEnabled: coalesceGlobalAppearance(row),
    updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    updatedByUserId: row?.updatedByUserId ?? null,
  };
}

export async function updateAdminAppearanceSettings(
  adminUserId: string,
  illustratedDesignEnabled: boolean,
): Promise<AdminAppearanceSettings> {
  const current = await getAdminAppearanceSettings();
  const updatedAt = new Date();

  await db
    .insert(platformAppearanceSettings)
    .values({
      id: SETTINGS_ID,
      illustratedDesignEnabled,
      updatedAt,
      updatedByUserId: adminUserId,
    })
    .onConflictDoUpdate({
      target: platformAppearanceSettings.id,
      set: {
        illustratedDesignEnabled,
        updatedAt,
        updatedByUserId: adminUserId,
      },
    });

  if (current.illustratedDesignEnabled !== illustratedDesignEnabled) {
    await db.insert(platformAppearanceAuditLogs).values({
      adminUserId,
      action: ILLUSTRATED_DESIGN_AUDIT_ACTION,
      oldValue: current.illustratedDesignEnabled,
      newValue: illustratedDesignEnabled,
      createdAt: updatedAt,
    });
  }

  return {
    illustratedDesignEnabled,
    updatedAt: updatedAt.toISOString(),
    updatedByUserId: adminUserId,
  };
}

export async function listRecentAppearanceAudit(limit = 5) {
  return db
    .select({
      adminUserId: platformAppearanceAuditLogs.adminUserId,
      action: platformAppearanceAuditLogs.action,
      oldValue: platformAppearanceAuditLogs.oldValue,
      newValue: platformAppearanceAuditLogs.newValue,
      createdAt: platformAppearanceAuditLogs.createdAt,
    })
    .from(platformAppearanceAuditLogs)
    .where(eq(platformAppearanceAuditLogs.action, ILLUSTRATED_DESIGN_AUDIT_ACTION))
    .orderBy(desc(platformAppearanceAuditLogs.createdAt))
    .limit(limit);
}

/** Used by account deletion. */
export async function deleteUserAppearancePreferences(userId: string) {
  await db
    .delete(userAppearancePreferences)
    .where(eq(userAppearancePreferences.userId, userId));
  await db
    .delete(platformAppearanceAuditLogs)
    .where(
      and(
        eq(platformAppearanceAuditLogs.adminUserId, userId),
        eq(platformAppearanceAuditLogs.action, ILLUSTRATED_DESIGN_AUDIT_ACTION),
      ),
    );
}
