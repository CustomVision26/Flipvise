"use server";

import { createClerkClient } from "@clerk/backend";
import { z } from "zod";
import {
  getSpecialFeaturePromoByCode,
  getSpecialFeaturePromoById,
  insertSpecialFeaturePromo,
  listSpecialFeaturePromos,
  setSpecialFeaturePromoActive,
  updateSpecialFeaturePromo,
} from "@/db/queries/special-feature-promos";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { auth } from "@/lib/clerk-auth";
import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import { stripe } from "@/lib/stripe";
import { STRIPE_COUPON_NAME_MAX_LEN } from "@/lib/affiliate-stripe-coupon";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

const KNOWN_CHANNELS = [
  { id: "expo", label: "Expo promo" },
  { id: "tv", label: "TV promo" },
  { id: "social", label: "Social media promo" },
] as const;

function normalizeChannel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();
  const known = KNOWN_CHANNELS.find(
    (item) => item.id === lower || item.label.toLowerCase() === lower,
  );
  return known?.id ?? normalized;
}

const createSchema = z.object({
  channel: z
    .string()
    .trim()
    .min(1, "Enter a channel name.")
    .max(40, "Channel names can be up to 40 characters.")
    .regex(/^[A-Za-z0-9][A-Za-z0-9 '&._-]*$/, "Use letters and numbers for the channel name.")
    .transform(normalizeChannel),
  label: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9]+$/, "Use letters and numbers only."),
  percentOff: z.number().int().min(1).max(100),
  planIds: z.array(z.string().min(1)).min(1),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
});

export type SpecialFeaturePromoView = {
  id: number;
  channel: string;
  code: string;
  label: string;
  percentOff: number;
  planIds: string[];
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

function toView(row: {
  id: number;
  channel: string;
  code: string;
  label: string;
  percentOff: number;
  planIds: string[];
  active: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}): SpecialFeaturePromoView {
  return {
    id: row.id,
    channel: row.channel,
    code: row.code,
    label: row.label,
    percentOff: row.percentOff,
    planIds: row.planIds,
    active: row.active,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
  };
}

async function requirePlatformAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (!isClerkPlatformAdminRole(role) && !isPlatformSuperadminAllowListed(userId)) {
    throw new Error("Forbidden");
  }
  return userId;
}

function parseOptionalDate(value: string | undefined, endOfDay: boolean): Date | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(endOfDay ? `${trimmed}T23:59:59` : `${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid date.");
  return date;
}

export async function listSpecialFeaturePromosAction(): Promise<SpecialFeaturePromoView[]> {
  await requirePlatformAdmin();
  const rows = await listSpecialFeaturePromos();
  return rows.map(toView);
}

export async function createSpecialFeaturePromoAction(
  input: z.infer<typeof createSchema>,
): Promise<SpecialFeaturePromoView> {
  const userId = await requirePlatformAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid promo.");
  }
  const data = parsed.data;
  const planIds = [...new Set(data.planIds)];
  if (planIds.some((id) => !isStripePaidPlanId(id))) {
    throw new Error("Choose paid plans only.");
  }
  const code = data.code.toUpperCase();
  const existing = await getSpecialFeaturePromoByCode(code);
  if (existing) throw new Error("That promo code is already in use.");

  const startsAt = parseOptionalDate(data.startsAt, false);
  const endsAt = parseOptionalDate(data.endsAt, true);
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("The end date must be after the start date.");
  }

  const redeemBy = endsAt ? Math.floor(endsAt.getTime() / 1000) : undefined;
  const couponName = data.label.slice(0, STRIPE_COUPON_NAME_MAX_LEN);
  const coupon = await stripe.coupons.create({
    percent_off: data.percentOff,
    duration: "forever",
    name: couponName,
    ...(redeemBy != null ? { redeem_by: redeemBy } : {}),
  });

  let promotionCodeId: string | null = null;
  try {
    const promotion = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code,
      ...(redeemBy != null ? { expires_at: redeemBy } : {}),
    });
    promotionCodeId = promotion.id;
  } catch (error) {
    console.error("[createSpecialFeaturePromo] Stripe promotion code", error);
  }

  const row = await insertSpecialFeaturePromo({
    channel: data.channel,
    code,
    label: data.label,
    percentOff: data.percentOff,
    planIds,
    stripeCouponId: coupon.id,
    stripePromotionCodeId: promotionCodeId,
    startsAt,
    endsAt,
    createdByUserId: userId,
  });
  return toView(row);
}

const updateSchema = z.object({
  id: z.number().int().positive(),
  channel: createSchema.shape.channel,
  label: createSchema.shape.label,
  percentOff: createSchema.shape.percentOff,
  planIds: createSchema.shape.planIds,
  startsAt: createSchema.shape.startsAt,
  endsAt: createSchema.shape.endsAt,
});

export async function updateSpecialFeaturePromoAction(
  input: z.infer<typeof updateSchema>,
): Promise<SpecialFeaturePromoView> {
  await requirePlatformAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid promo.");
  }
  const data = parsed.data;
  const existing = await getSpecialFeaturePromoById(data.id);
  if (!existing) throw new Error("That promo could not be found.");
  const planIds = [...new Set(data.planIds)];
  if (planIds.some((id) => !isStripePaidPlanId(id))) {
    throw new Error("Choose paid plans only.");
  }
  const startsAt = parseOptionalDate(data.startsAt, false);
  const endsAt = parseOptionalDate(data.endsAt, true);
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("The end date must be after the start date.");
  }

  const couponName = data.label.slice(0, STRIPE_COUPON_NAME_MAX_LEN);
  const redeemBy = endsAt ? Math.floor(endsAt.getTime() / 1000) : undefined;
  let stripeCouponId = existing.stripeCouponId;
  if (data.percentOff !== existing.percentOff) {
    const coupon = await stripe.coupons.create({
      percent_off: data.percentOff,
      duration: "forever",
      name: couponName,
      ...(redeemBy != null ? { redeem_by: redeemBy } : {}),
    });
    stripeCouponId = coupon.id;
  } else {
    try {
      await stripe.coupons.update(existing.stripeCouponId, { name: couponName });
    } catch (error) {
      console.error("[updateSpecialFeaturePromo] Stripe coupon name", error);
    }
  }

  const row = await updateSpecialFeaturePromo(existing.id, {
    channel: data.channel,
    label: data.label,
    percentOff: data.percentOff,
    planIds,
    stripeCouponId,
    startsAt,
    endsAt,
  });
  return toView(row);
}

export async function setSpecialFeaturePromoActiveAction(input: {
  id: number;
  active: boolean;
}): Promise<void> {
  await requirePlatformAdmin();
  const parsed = z
    .object({ id: z.number().int().positive(), active: z.boolean() })
    .safeParse(input);
  if (!parsed.success) throw new Error("Invalid promo.");
  await setSpecialFeaturePromoActive(parsed.data.id, parsed.data.active);
}
