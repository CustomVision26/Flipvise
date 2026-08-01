import { db } from "@/db";
import {
  addonCatalog,
  addonCatalogSettings,
  userAddonEntitlements,
  type AddonCatalogRow,
  type AddonCatalogSettingsRow,
  type UserAddonEntitlementRow,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

const SETTINGS_ID = 1;

export type { AddonCatalogRow, AddonCatalogSettingsRow, UserAddonEntitlementRow };

export async function getAddonCatalogSettings(): Promise<AddonCatalogSettingsRow> {
  const [row] = await db
    .select()
    .from(addonCatalogSettings)
    .where(eq(addonCatalogSettings.id, SETTINGS_ID))
    .limit(1);
  if (row) return row;

  const [inserted] = await db
    .insert(addonCatalogSettings)
    .values({ id: SETTINGS_ID, pricingCatalogVisible: false })
    .onConflictDoNothing({ target: addonCatalogSettings.id })
    .returning();
  if (inserted) return inserted;

  const [again] = await db
    .select()
    .from(addonCatalogSettings)
    .where(eq(addonCatalogSettings.id, SETTINGS_ID))
    .limit(1);
  if (!again) {
    throw new Error("Failed to initialize addon_catalog_settings");
  }
  return again;
}

export async function setAddonCatalogPricingVisible(input: {
  visible: boolean;
  updatedByUserId: string;
}): Promise<AddonCatalogSettingsRow> {
  const now = new Date();
  await db
    .insert(addonCatalogSettings)
    .values({
      id: SETTINGS_ID,
      pricingCatalogVisible: input.visible,
      updatedAt: now,
      updatedByUserId: input.updatedByUserId,
    })
    .onConflictDoUpdate({
      target: addonCatalogSettings.id,
      set: {
        pricingCatalogVisible: input.visible,
        updatedAt: now,
        updatedByUserId: input.updatedByUserId,
      },
    });
  return getAddonCatalogSettings();
}

export async function listAddonCatalog(): Promise<AddonCatalogRow[]> {
  return db.select().from(addonCatalog).orderBy(desc(addonCatalog.createdAt));
}

export async function getAddonCatalogByKey(key: string): Promise<AddonCatalogRow | null> {
  const [row] = await db
    .select()
    .from(addonCatalog)
    .where(eq(addonCatalog.key, key))
    .limit(1);
  return row ?? null;
}

export async function listPublishedActiveAddonsForPricing(): Promise<AddonCatalogRow[]> {
  return db
    .select()
    .from(addonCatalog)
    .where(and(eq(addonCatalog.active, true), eq(addonCatalog.publishedOnPricing, true)))
    .orderBy(desc(addonCatalog.createdAt));
}

export async function updateAddonCatalogFlags(input: {
  key: string;
  active?: boolean;
  publishedOnPricing?: boolean;
}): Promise<AddonCatalogRow | null> {
  const patch: Partial<AddonCatalogRow> = { updatedAt: new Date() };
  if (typeof input.active === "boolean") patch.active = input.active;
  if (typeof input.publishedOnPricing === "boolean") {
    patch.publishedOnPricing = input.publishedOnPricing;
  }
  const [row] = await db
    .update(addonCatalog)
    .set(patch)
    .where(eq(addonCatalog.key, input.key))
    .returning();
  return row ?? null;
}

export async function upsertAddonCatalogEntry(input: {
  key: string;
  name: string;
  description?: string;
  marketingBlurb?: string;
  eligiblePlanIds: string[];
  stripePriceEnvKey?: string;
  active?: boolean;
  publishedOnPricing?: boolean;
}): Promise<AddonCatalogRow> {
  const now = new Date();
  const [row] = await db
    .insert(addonCatalog)
    .values({
      key: input.key,
      name: input.name,
      description: input.description ?? "",
      marketingBlurb: input.marketingBlurb ?? "",
      eligiblePlanIds: input.eligiblePlanIds,
      stripePriceEnvKey: input.stripePriceEnvKey ?? "",
      active: input.active ?? true,
      publishedOnPricing: input.publishedOnPricing ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: addonCatalog.key,
      set: {
        name: input.name,
        description: input.description ?? "",
        marketingBlurb: input.marketingBlurb ?? "",
        eligiblePlanIds: input.eligiblePlanIds,
        stripePriceEnvKey: input.stripePriceEnvKey ?? "",
        active: input.active ?? true,
        publishedOnPricing: input.publishedOnPricing ?? false,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error(`Failed to upsert addon catalog key "${input.key}"`);
  return row;
}

export async function listActiveAddonKeysForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ addonKey: userAddonEntitlements.addonKey })
    .from(userAddonEntitlements)
    .where(
      and(
        eq(userAddonEntitlements.userId, userId),
        eq(userAddonEntitlements.status, "active"),
      ),
    );
  return rows.map((r) => r.addonKey);
}

/** Active entitlements for a user (full rows — source, Stripe ids, etc.). */
export async function listActiveUserAddonEntitlements(
  userId: string,
): Promise<UserAddonEntitlementRow[]> {
  return db
    .select()
    .from(userAddonEntitlements)
    .where(
      and(
        eq(userAddonEntitlements.userId, userId),
        eq(userAddonEntitlements.status, "active"),
      ),
    );
}

/**
 * Add-on keys the user may use given their effective plan.
 * Stripe/team entitlements require plan eligibility (Free → none).
 * Platform-admin grants remain available regardless of plan.
 */
export async function listAccessibleAddonKeysForUser(
  userId: string,
  effectivePlanSlug: string | null | undefined,
): Promise<string[]> {
  const entitlements = await listActiveUserAddonEntitlements(userId);
  if (entitlements.length === 0) return [];

  const keys: string[] = [];
  for (const row of entitlements) {
    if (row.source === "admin") {
      keys.push(row.addonKey);
      continue;
    }
    const catalog = await getAddonCatalogByKey(row.addonKey);
    if (!catalog) continue;
    if (isPlanEligibleForAddon(catalog.eligiblePlanIds, effectivePlanSlug)) {
      keys.push(row.addonKey);
    }
  }
  return keys;
}

export async function getUserAddonEntitlement(
  userId: string,
  addonKey: string,
): Promise<UserAddonEntitlementRow | null> {
  const [row] = await db
    .select()
    .from(userAddonEntitlements)
    .where(
      and(
        eq(userAddonEntitlements.userId, userId),
        eq(userAddonEntitlements.addonKey, addonKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listUserAddonEntitlements(
  userId: string,
): Promise<UserAddonEntitlementRow[]> {
  return db
    .select()
    .from(userAddonEntitlements)
    .where(eq(userAddonEntitlements.userId, userId))
    .orderBy(desc(userAddonEntitlements.updatedAt));
}

export async function upsertActiveStripeAddonEntitlement(input: {
  userId: string;
  addonKey: string;
  stripeSubscriptionId: string;
  stripeSubscriptionItemId?: string | null;
}): Promise<UserAddonEntitlementRow> {
  const now = new Date();
  const [row] = await db
    .insert(userAddonEntitlements)
    .values({
      userId: input.userId,
      addonKey: input.addonKey,
      source: "stripe",
      status: "active",
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeSubscriptionItemId: input.stripeSubscriptionItemId ?? null,
      grantedByAdminUserId: null,
      teamId: null,
      startsAt: now,
      endsAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userAddonEntitlements.userId, userAddonEntitlements.addonKey],
      set: {
        source: "stripe",
        status: "active",
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeSubscriptionItemId: input.stripeSubscriptionItemId ?? null,
        grantedByAdminUserId: null,
        teamId: null,
        endsAt: null,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to upsert Stripe add-on entitlement");
  return row;
}

export async function assignAdminAddonEntitlement(input: {
  userId: string;
  addonKey: string;
  grantedByAdminUserId: string;
}): Promise<UserAddonEntitlementRow> {
  const now = new Date();
  const [row] = await db
    .insert(userAddonEntitlements)
    .values({
      userId: input.userId,
      addonKey: input.addonKey,
      source: "admin",
      status: "active",
      stripeSubscriptionId: null,
      stripeSubscriptionItemId: null,
      grantedByAdminUserId: input.grantedByAdminUserId,
      teamId: null,
      startsAt: now,
      endsAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userAddonEntitlements.userId, userAddonEntitlements.addonKey],
      set: {
        source: "admin",
        status: "active",
        grantedByAdminUserId: input.grantedByAdminUserId,
        teamId: null,
        endsAt: null,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to assign admin add-on entitlement");
  return row;
}

/**
 * Team-admin grant. Does not overwrite an active Stripe or platform-admin entitlement.
 * Returns the existing row when access is already covered by a higher-priority source.
 */
export async function assignTeamAddonEntitlement(input: {
  userId: string;
  addonKey: string;
  grantedByTeamAdminUserId: string;
  teamId: number;
}): Promise<{ entitlement: UserAddonEntitlementRow; createdOrUpdated: boolean }> {
  const existing = await getUserAddonEntitlement(input.userId, input.addonKey);
  if (
    existing?.status === "active" &&
    (existing.source === "stripe" || existing.source === "admin")
  ) {
    return { entitlement: existing, createdOrUpdated: false };
  }

  const now = new Date();
  const [row] = await db
    .insert(userAddonEntitlements)
    .values({
      userId: input.userId,
      addonKey: input.addonKey,
      source: "team",
      status: "active",
      stripeSubscriptionId: null,
      stripeSubscriptionItemId: null,
      grantedByAdminUserId: input.grantedByTeamAdminUserId,
      teamId: input.teamId,
      startsAt: now,
      endsAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [userAddonEntitlements.userId, userAddonEntitlements.addonKey],
      set: {
        source: "team",
        status: "active",
        grantedByAdminUserId: input.grantedByTeamAdminUserId,
        teamId: input.teamId,
        stripeSubscriptionId: null,
        stripeSubscriptionItemId: null,
        endsAt: null,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to assign team add-on entitlement");
  return { entitlement: row, createdOrUpdated: true };
}

/** Revoke only team-sourced entitlements for a member (never Stripe / platform admin). */
export async function revokeTeamAddonEntitlement(input: {
  userId: string;
  addonKey: string;
  teamId: number;
}): Promise<UserAddonEntitlementRow | null> {
  const existing = await getUserAddonEntitlement(input.userId, input.addonKey);
  if (!existing || existing.status !== "active" || existing.source !== "team") {
    return null;
  }
  if (existing.teamId != null && existing.teamId !== input.teamId) {
    return null;
  }
  return revokeUserAddonEntitlement({
    userId: input.userId,
    addonKey: input.addonKey,
    status: "revoked",
  });
}

export async function listActiveEntitlementsForAddon(
  addonKey: string,
): Promise<UserAddonEntitlementRow[]> {
  return db
    .select()
    .from(userAddonEntitlements)
    .where(
      and(
        eq(userAddonEntitlements.addonKey, addonKey),
        eq(userAddonEntitlements.status, "active"),
      ),
    )
    .orderBy(desc(userAddonEntitlements.updatedAt));
}

/** All active add-on entitlements (admin subscription tables). */
export async function listAllActiveAddonEntitlements(): Promise<
  UserAddonEntitlementRow[]
> {
  return db
    .select()
    .from(userAddonEntitlements)
    .where(eq(userAddonEntitlements.status, "active"))
    .orderBy(desc(userAddonEntitlements.updatedAt));
}

export async function listTeamMemberAddonKeys(
  userIds: string[],
  addonKey: string,
): Promise<Map<string, UserAddonEntitlementRow>> {
  const map = new Map<string, UserAddonEntitlementRow>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select()
    .from(userAddonEntitlements)
    .where(
      and(
        inArray(userAddonEntitlements.userId, userIds),
        eq(userAddonEntitlements.addonKey, addonKey),
        eq(userAddonEntitlements.status, "active"),
      ),
    );
  for (const row of rows) {
    map.set(row.userId, row);
  }
  return map;
}

export async function revokeUserAddonEntitlement(input: {
  userId: string;
  addonKey: string;
  status?: "revoked" | "canceled";
}): Promise<UserAddonEntitlementRow | null> {
  const now = new Date();
  const [row] = await db
    .update(userAddonEntitlements)
    .set({
      status: input.status ?? "revoked",
      endsAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(userAddonEntitlements.userId, input.userId),
        eq(userAddonEntitlements.addonKey, input.addonKey),
      ),
    )
    .returning();
  return row ?? null;
}

export async function cancelStripeAddonEntitlementBySubscription(
  stripeSubscriptionId: string,
): Promise<UserAddonEntitlementRow[]> {
  const now = new Date();
  return db
    .update(userAddonEntitlements)
    .set({
      status: "canceled",
      endsAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(userAddonEntitlements.stripeSubscriptionId, stripeSubscriptionId),
        eq(userAddonEntitlements.status, "active"),
      ),
    )
    .returning();
}

export function isPlanEligibleForAddon(
  eligiblePlanIds: string[],
  effectivePlanSlug: string | null | undefined,
): boolean {
  if (!effectivePlanSlug) return false;
  return eligiblePlanIds.includes(effectivePlanSlug);
}
