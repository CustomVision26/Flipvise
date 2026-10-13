import { db } from "@/db";
import { specialFeaturePromos } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export type SpecialFeaturePromoRow = typeof specialFeaturePromos.$inferSelect;

export async function listSpecialFeaturePromos(): Promise<SpecialFeaturePromoRow[]> {
  return db
    .select()
    .from(specialFeaturePromos)
    .orderBy(desc(specialFeaturePromos.createdAt));
}

export async function getSpecialFeaturePromoByCode(
  code: string,
): Promise<SpecialFeaturePromoRow | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const rows = await db
    .select()
    .from(specialFeaturePromos)
    .where(sql`UPPER(${specialFeaturePromos.code}) = ${normalized}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function insertSpecialFeaturePromo(values: {
  channel: string;
  code: string;
  label: string;
  percentOff: number;
  planIds: string[];
  stripeCouponId: string;
  stripePromotionCodeId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  createdByUserId: string;
}): Promise<SpecialFeaturePromoRow> {
  const rows = await db
    .insert(specialFeaturePromos)
    .values({
      channel: values.channel,
      code: values.code.trim().toUpperCase(),
      label: values.label.trim(),
      percentOff: values.percentOff,
      planIds: values.planIds,
      stripeCouponId: values.stripeCouponId,
      stripePromotionCodeId: values.stripePromotionCodeId,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      createdByUserId: values.createdByUserId,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Could not save the special feature promo.");
  return row;
}

export async function getSpecialFeaturePromoById(
  id: number,
): Promise<SpecialFeaturePromoRow | null> {
  const rows = await db
    .select()
    .from(specialFeaturePromos)
    .where(eq(specialFeaturePromos.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function updateSpecialFeaturePromo(
  id: number,
  values: {
    channel: string;
    label: string;
    percentOff: number;
    planIds: string[];
    stripeCouponId: string;
    startsAt: Date | null;
    endsAt: Date | null;
  },
): Promise<SpecialFeaturePromoRow> {
  const rows = await db
    .update(specialFeaturePromos)
    .set({
      channel: values.channel,
      label: values.label.trim(),
      percentOff: values.percentOff,
      planIds: values.planIds,
      stripeCouponId: values.stripeCouponId,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
    })
    .where(eq(specialFeaturePromos.id, id))
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Could not update the special feature promo.");
  return row;
}

export async function setSpecialFeaturePromoActive(
  id: number,
  active: boolean,
): Promise<void> {
  await db
    .update(specialFeaturePromos)
    .set({ active })
    .where(eq(specialFeaturePromos.id, id));
}
