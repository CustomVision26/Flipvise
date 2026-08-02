"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignAdminAddonEntitlement,
  assignTeamAddonEntitlement,
  getAddonCatalogByKey,
  getUserAddonEntitlement,
  isPlanEligibleForAddon,
  listAddonCatalog,
  revokeTeamAddonEntitlement,
  revokeUserAddonEntitlement,
  setAddonCatalogPricingVisible,
  updateAddonCatalogFlags,
  upsertAddonCatalogEntry,
} from "@/db/queries/addons";
import {
  AI_ESSAY_ADDON_KEY,
  LIVE_CLASSROOM_ADDON_KEY,
} from "@/lib/addon-keys";
import { LIVE_CLASSROOM_ELIGIBLE_PLAN_IDS } from "@/lib/live-classroom-eligibility";
import { stripeAddonPriceEnvKeyForAddonKey } from "@/lib/stripe-addon-price-env";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
} from "@/db/queries/stripe-subscriptions";
import { getTeamById, getTeamsForTeamDashboard, listTeamMembers } from "@/db/queries/teams";
import { getAccessContext } from "@/lib/access";
import { assertAdminDashboardAccess } from "@/lib/admin/assert-admin-access";
import { resolveEffectivePlan } from "@/lib/plan-metadata-billing-resolution";
import { stripe, resolveAppUrl } from "@/lib/stripe";
import { personalDashboardHrefAfterAddonCheckoutSuccess } from "@/lib/personal-dashboard-url";
import { STRIPE_ADDON_META_TYPE } from "@/lib/stripe-addon-metadata";
import {
  resolveStripeAddonPriceIdFromEnvKey,
  type AddonBillingPeriod,
} from "@/lib/stripe-addon-price-env";
import {
  addonCheckoutSubscriptionAlignParams,
  resolveAddonCheckoutAlignment,
} from "@/lib/stripe-addon-billing-align";
import {
  cancelStripeAddonBilling,
  resumeStripeAddonRenewal,
  scheduleStripeAddonCancelAtPeriodEnd,
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
  period: z.enum(["monthly", "yearly"]).optional().default("monthly"),
});

/**
 * Purchase an add-on (monthly or yearly) via Stripe Checkout (subscription mode).
 * Always opens checkout — never silently attaches a line item to an existing plan.
 */
export async function createAddonCheckoutSessionAction(
  data: z.infer<typeof createAddonCheckoutSchema>,
): Promise<{ mode: "checkout"; sessionId: string; clientSecret: string }> {
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

  const period: AddonBillingPeriod = parsed.data.period;
  const priceId = resolveStripeAddonPriceIdFromEnvKey(
    catalog.stripePriceEnvKey,
    period,
  );
  if (!priceId) {
    const hint =
      period === "yearly"
        ? catalog.stripePriceEnvKey.replace(/_PRICE_ID$/, "_YEARLY_PRICE_ID")
        : catalog.stripePriceEnvKey;
    throw new Error(
      `Stripe price not configured for add-on "${catalog.key}" (${period}). Set ${hint}.`,
    );
  }

  const appUrl = resolveAppUrl();
  const alignment = await resolveAddonCheckoutAlignment(access.userId, period);
  const subscriptionMetadata: Record<string, string> = {
    type: STRIPE_ADDON_META_TYPE,
    addonKey: catalog.key,
    clerkUserId: access.userId,
    period,
    ...(alignment
      ? {
          alignsWithBasePeriodEnd: alignment.alignsWithPeriodEndIso,
          usesBasePeriodEnd: alignment.usesBasePeriodEnd ? "true" : "false",
        }
      : {}),
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
      ...(alignment ? addonCheckoutSubscriptionAlignParams(alignment) : {}),
    },
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    return_url: `${appUrl}${personalDashboardHrefAfterAddonCheckoutSuccess({
      userId: access.userId,
      currentPlanSlug: planSlug,
    })}`,
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
  publishedOnBanner: z.boolean().optional(),
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
    publishedOnBanner: parsed.data.publishedOnBanner,
  });
  if (!row) throw new Error("Add-on not found");
  revalidatePath("/admin/add-ons");
  revalidatePath("/pricing/add-ons");
  revalidatePath("/pricing");
  revalidatePath("/", "layout");
  revalidatePath("/dashboard", "layout");
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

  const addonKey = parsed.data.addonKey.trim();
  let catalog = await getAddonCatalogByKey(addonKey);
  if (!catalog) {
    // Case-insensitive recovery (Select / copy-paste quirks).
    const all = await listAddonCatalog();
    catalog =
      all.find((row) => row.key.toLowerCase() === addonKey.toLowerCase()) ??
      null;
  }
  // Self-heal known catalog keys if the seed row is missing (common after
  // partial migrations) so complimentary admin grants are never blocked.
  if (!catalog && addonKey === LIVE_CLASSROOM_ADDON_KEY) {
    catalog = await upsertAddonCatalogEntry({
      key: LIVE_CLASSROOM_ADDON_KEY,
      name: "Flipvise Live Classroom™",
      description:
        "Run real-time interactive learning sessions with warm-up battles, team competitions, exit tickets, strategy cards, and AI session reports.",
      marketingBlurb:
        "Turn Flipvise into a live teaching platform for Team and Enterprise organizations.",
      eligiblePlanIds: [...LIVE_CLASSROOM_ELIGIBLE_PLAN_IDS],
      stripePriceEnvKey: stripeAddonPriceEnvKeyForAddonKey(LIVE_CLASSROOM_ADDON_KEY),
      active: true,
      publishedOnPricing: false,
    });
  }
  if (!catalog && addonKey === AI_ESSAY_ADDON_KEY) {
    catalog = await getAddonCatalogByKey(AI_ESSAY_ADDON_KEY);
  }
  if (!catalog) {
    throw new Error(
      `Add-on "${addonKey}" was not found in the catalog. Refresh the page and try again.`,
    );
  }

  // Platform-admin complimentary grants may assign even when Active is off
  // (Active mainly gates self-serve purchases / team assigns). Also bypasses
  // plan eligibility — see listAccessibleAddonKeysForUser.
  await assignAdminAddonEntitlement({
    userId: parsed.data.targetUserId,
    addonKey: catalog.key,
    grantedByAdminUserId: admin.userId,
  });
  revalidatePath("/admin/add-ons");
  revalidatePath("/admin/all-users");
  revalidatePath("/pricing/add-ons");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/live-classroom");
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
  revalidatePath("/dashboard", "layout");
}

const teamAddonSchema = z.object({
  teamId: z.number().int().positive(),
  memberUserId: z.string().min(1),
  addonKey: addonKeySchema,
  enabled: z.boolean(),
});

/**
 * Team Admin assign/remove an add-on for a workspace member.
 * Does not cancel Stripe billing or revoke platform-admin grants.
 */
export async function setTeamMemberAddonAction(
  data: z.infer<typeof teamAddonSchema>,
) {
  const parsed = teamAddonSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const manageable = await getTeamsForTeamDashboard(access.userId);
  const teamRow = manageable.find((t) => t.id === parsed.data.teamId);
  if (!teamRow) throw new Error("You cannot manage add-ons for this workspace.");

  const team = await getTeamById(parsed.data.teamId);
  if (!team) throw new Error("Workspace not found.");

  const members = await listTeamMembers(parsed.data.teamId);
  const member = members.find((m) => m.userId === parsed.data.memberUserId);
  if (!member && team.ownerUserId !== parsed.data.memberUserId) {
    throw new Error("Member is not in this workspace.");
  }

  const catalog = await getAddonCatalogByKey(parsed.data.addonKey);
  if (!catalog || !catalog.active) {
    throw new Error("This add-on is not available for assignment.");
  }

  if (parsed.data.enabled) {
    await assignTeamAddonEntitlement({
      userId: parsed.data.memberUserId,
      addonKey: catalog.key,
      grantedByTeamAdminUserId: access.userId,
      teamId: parsed.data.teamId,
    });
  } else {
    const existing = await getUserAddonEntitlement(
      parsed.data.memberUserId,
      catalog.key,
    );
    if (existing?.status === "active" && existing.source !== "team") {
      throw new Error(
        "This member’s add-on was purchased or granted outside Team Admin and cannot be removed here.",
      );
    }
    await revokeTeamAddonEntitlement({
      userId: parsed.data.memberUserId,
      addonKey: catalog.key,
      teamId: parsed.data.teamId,
    });
  }

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/ai-doc-studio", "layout");
  revalidatePath("/dashboard/ai-doc-studio/ai-essay", "layout");
}

const cancelOwnAddonSchema = z.object({
  addonKey: addonKeySchema,
});

/**
 * Cancel only the signed-in user's add-on renewal (cancel_at_period_end).
 * Does not cancel or change their base plan subscription.
 */
export async function cancelOwnAddonRenewalAction(
  data: z.infer<typeof cancelOwnAddonSchema>,
): Promise<{ periodEndIso: string }> {
  const parsed = cancelOwnAddonSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const existing = await getUserAddonEntitlement(
    access.userId,
    parsed.data.addonKey,
  );
  if (!existing || existing.status !== "active") {
    throw new Error("You do not have an active entitlement for this add-on.");
  }
  if (existing.source !== "stripe" || !existing.stripeSubscriptionId) {
    throw new Error(
      "This add-on is not billed on Stripe for your account, so renewal cannot be canceled here.",
    );
  }

  const result = await scheduleStripeAddonCancelAtPeriodEnd({
    stripeSubscriptionId: existing.stripeSubscriptionId,
  });

  try {
    const { getManageableStripeSubscription } = await import(
      "@/db/queries/stripe-subscriptions"
    );
    const { recordAddonRenewalCanceledInboxMessage } = await import(
      "@/lib/record-renewal-cancel-inbox"
    );
    const baseSub = await getManageableStripeSubscription(access.userId);
    const catalog = await getAddonCatalogByKey(parsed.data.addonKey);
    await recordAddonRenewalCanceledInboxMessage({
      recipientUserId: access.userId,
      stripeSubscriptionId: existing.stripeSubscriptionId,
      addonKey: parsed.data.addonKey,
      addonLabel: catalog?.name?.trim() || parsed.data.addonKey,
      planSlug: baseSub?.planSlug ?? null,
      periodEnd: new Date(result.periodEndIso),
    });
  } catch (error) {
    console.error("[cancelOwnAddonRenewalAction] inbox", error);
  }

  revalidatePath("/pricing/add-ons");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/inbox");
  return { periodEndIso: result.periodEndIso };
}

const resumeOwnAddonsSchema = z.object({
  addonKeys: z.array(addonKeySchema).min(1).max(20),
});

/**
 * Resume auto-renewal for add-ons that were scheduled to cancel at period end.
 * Does not change the base plan subscription.
 */
export async function resumeOwnAddonRenewalsAction(
  data: z.infer<typeof resumeOwnAddonsSchema>,
): Promise<{ resumedAddonKeys: string[]; periodEndIso: string }> {
  const parsed = resumeOwnAddonsSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const access = await getAccessContext();
  if (!access.userId) throw new Error("Unauthorized");

  const resumedAddonKeys: string[] = [];
  let periodEndIso = new Date().toISOString();

  for (const addonKey of [...new Set(parsed.data.addonKeys)]) {
    const existing = await getUserAddonEntitlement(access.userId, addonKey);
    if (!existing || existing.status !== "active") {
      throw new Error(`No active entitlement for add-on “${addonKey}”.`);
    }
    if (existing.source !== "stripe" || !existing.stripeSubscriptionId) {
      throw new Error(
        `Add-on “${addonKey}” is not billed on Stripe, so renewal cannot be resumed here.`,
      );
    }
    const result = await resumeStripeAddonRenewal({
      stripeSubscriptionId: existing.stripeSubscriptionId,
    });
    periodEndIso = result.periodEndIso;
    resumedAddonKeys.push(addonKey);
  }

  revalidatePath("/pricing/add-ons");
  revalidatePath("/dashboard", "layout");
  return { resumedAddonKeys, periodEndIso };
}
