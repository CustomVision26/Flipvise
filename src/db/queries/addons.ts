import { db } from "@/db";
import {
  addonCatalog,
  addonCatalogSettings,
  userAddonEntitlements,
  type AddonCatalogRow,
  type AddonCatalogSettingsRow,
  type UserAddonEntitlementRow,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

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
        endsAt: null,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("Failed to assign admin add-on entitlement");
  return row;
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
