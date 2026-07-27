"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignAdminAddonEntitlement,
  getAddonCatalogByKey,
  getUserAddonEntitlement,
  isPlanEligibleForAddon,
  revokeUserAddonEntitlement,
  setAddonCatalogPricingVisible,
  updateAddonCatalogFlags,
} from "@/db/queries/addons";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
} from "@/db/queries/stripe-subscriptions";
import { getAccessContext } from "@/lib/access";
import { assertAdminDashboardAccess } from "@/lib/admin/assert-admin-access";
import { resolveEffectivePlan } from "@/lib/plan-metadata-billing-resolution";
import { stripe, resolveAppUrl } from "@/lib/stripe";
import { STRIPE_ADDON_META_TYPE } from "@/lib/stripe-addon-metadata";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";
import {
  attachAddonItemToSubscription,
  cancelStripeAddonBilling,
} from "@/lib/stripe-addon-sync";
import { stripeCheckoutElementsSessionParams } from "@/lib/stripe-checkout-branding";
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const addonKeySchema = z.string().min(1).max(128);

async function resolveEffectivePlanSlugForUser(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);
  return resolveEffectivePlan(user.publicMetadata as Record<string, unknown>);
}

async function resolveCheckoutCustomerParams(userId: string) {
  const sub =
    (await getManageableStripeSubscription(userId)) ??
    (await getActiveStripeSubscription(userId));
  if (sub?.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(sub.stripeCustomerId);
      if (!("deleted" in customer && customer.deleted)) {
        return {
          customer: sub.stripeCustomerId,
          customer_update: { name: "auto" as const },
        };
      }
    } catch {
      // fall through
    }
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    const email =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    if (email) return { customer_email: email };
  } catch {
    // omit
  }
  return {};
}

const createAddonCheckoutSchema = z.object({
  addonKey: addonKeySchema,
});

/**
 * Purchase a monthly add-on. Attaches a subscription item when a base plan sub exists;
 * otherwise opens Checkout for an add-on-only subscription.
 */
export async function createAddonCheckoutSessionAction(
  data: z.infer<typeof createAddonCheckoutSchema>,
): Promise<
  | { mode: "attached"; addonKey: string }
  | { mode: "checkout"; sessionId: string; clientSecret: string }
> {
  const parsed = createAddonCheckoutSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid add-on checkout input");

  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const catalog = await getAddonCatalogByKey(parsed.data.addonKey);
  if (!catalog || !catalog.active) {
    throw new Error("This add-on is not available.");
  }

  const planSlug =
    access.effectivePlanSlug ??
    (await resolveEffectivePlanSlugForUser(access.userId));
  if (!isPlanEligibleForAddon(catalog.eligiblePlanIds, planSlug)) {
    throw new Error("Your current plan is not eligible for this add-on.");
  }

  const existing = await getUserAddonEntitlement(access.userId, catalog.key);
  if (existing?.status === "active") {
    throw new Error("You already have this add-on.");
  }

  const priceId = resolveStripeAddonPriceIdFromEnvKey(catalog.stripePriceEnvKey);
  if (!priceId) {
    throw new Error(
      `Stripe price not configured for add-on "${catalog.key}". Set ${catalog.stripePriceEnvKey}.`,
    );
  }

  const baseSub =
    (await getActiveStripeSubscription(access.userId)) ??
    (await getManageableStripeSubscription(access.userId));

  if (baseSub?.stripeSubscriptionId) {
    try {
      await attachAddonItemToSubscription({
        subscriptionId: baseSub.stripeSubscriptionId,
        priceId,
        userId: access.userId,
        addonKey: catalog.key,
      });
      revalidatePath("/pricing/add-ons");
      revalidatePath("/pricing");
      revalidatePath("/dashboard", "layout");
      return { mode: "attached", addonKey: catalog.key };
    } catch (error) {
      console.error("[createAddonCheckoutSessionAction] attach item failed:", error);
      // Fall through to Checkout for a standalone add-on subscription.
    }
  }

  const appUrl = resolveAppUrl();
  const subscriptionMetadata: Record<string, string> = {
    type: STRIPE_ADDON_META_TYPE,
    addonKey: catalog.key,
    clerkUserId: access.userId,
  };

  const checkoutCustomer = await resolveCheckoutCustomerParams(access.userId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...checkoutCustomer,
    ...stripeCheckoutElementsSessionParams(),
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: {
      description: `Flipvise add-on: ${catalog.name}`,
      metadata: subscriptionMetadata,
    },
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    return_url: `${appUrl}/pricing/add-ons?addon_checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    metadata: subscriptionMetadata,
  });

  if (!session.client_secret) {
    throw new Error("Failed to create add-on checkout session");
  }

  return {
    mode: "checkout",
    sessionId: session.id,
    clientSecret: session.client_secret,
  };
}

const setPricingVisibleSchema = z.object({
  visible: z.boolean(),
});

export async function setPricingAddonCatalogVisibleAction(
  data: z.infer<typeof setPricingVisibleSchema>,
) {
  const parsed = setPricingVisibleSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  const admin = await assertAdminDashboardAccess();
  await setAddonCatalogPricingVisible({
    visible: parsed.data.visible,
    updatedByUserId: admin.userId,
  });
  revalidatePath("/admin/add-ons");
  revalidatePath("/pricing");
  revalidatePath("/pricing/add-ons");
}

const setCatalogFlagsSchema = z.object({
  addonKey: addonKeySchema,
  active: z.boolean().optional(),
  publishedOnPricing: z.boolean().optional(),
});

export async function setAddonCatalogFlagsAction(
  data: z.infer<typeof setCatalogFlagsSchema>,
) {
  const parsed = setCatalogFlagsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  await assertAdminDashboardAccess();
  const row = await updateAddonCatalogFlags({
    key: parsed.data.addonKey,
    active: parsed.data.active,
    publishedOnPricing: parsed.data.publishedOnPricing,
  });
  if (!row) throw new Error("Add-on not found");
  revalidatePath("/admin/add-ons");
  revalidatePath("/pricing/add-ons");
  revalidatePath("/pricing");
  return row;
}

const assignAddonSchema = z.object({
  targetUserId: z.string().min(1),
  addonKey: addonKeySchema,
});

export async function assignAddonToUserAction(data: z.infer<typeof assignAddonSchema>) {
  const parsed = assignAddonSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  const admin = await assertAdminDashboardAccess();

  const catalog = await getAddonCatalogByKey(parsed.data.addonKey);
  if (!catalog || !catalog.active) {
    throw new Error("This add-on is not available for assignment.");
  }

  const planSlug = await resolveEffectivePlanSlugForUser(parsed.data.targetUserId);
  if (!isPlanEligibleForAddon(catalog.eligiblePlanIds, planSlug)) {
    throw new Error(
      `User plan (${planSlug ?? "free"}) is not eligible for add-on "${catalog.key}".`,
    );
  }

  await assignAdminAddonEntitlement({
    userId: parsed.data.targetUserId,
    addonKey: catalog.key,
    grantedByAdminUserId: admin.userId,
  });
  revalidatePath("/admin/add-ons");
  revalidatePath("/admin/all-users");
  revalidatePath("/pricing/add-ons");
}

const revokeAddonSchema = z.object({
  targetUserId: z.string().min(1),
  addonKey: addonKeySchema,
  cancelStripe: z.boolean().optional(),
});

export async function revokeAddonFromUserAction(data: z.infer<typeof revokeAddonSchema>) {
  const parsed = revokeAddonSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");
  await assertAdminDashboardAccess();

  const existing = await getUserAddonEntitlement(
    parsed.data.targetUserId,
    parsed.data.addonKey,
  );
  if (!existing) throw new Error("No entitlement found for this user and add-on.");

  if (parsed.data.cancelStripe !== false && existing.source === "stripe") {
    await cancelStripeAddonBilling({
      stripeSubscriptionId: existing.stripeSubscriptionId,
      stripeSubscriptionItemId: existing.stripeSubscriptionItemId,
    });
  }

  await revokeUserAddonEntitlement({
    userId: parsed.data.targetUserId,
    addonKey: parsed.data.addonKey,
    status: "revoked",
  });
  revalidatePath("/admin/add-ons");
  revalidatePath("/admin/all-users");
  revalidatePath("/pricing/add-ons");
}
