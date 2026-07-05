import type { ClerkClient } from "@clerk/backend";
import {
  canonicalTeamPlanId,
  isTeamPlanId,
  resolveActiveTeamPlanFromHas,
  type TeamPlanId,
} from "@/lib/team-plans";
import { isEducationPlanId, isEducationTeamPlanId } from "@/lib/education-plans";

/** ISO timestamp written whenever an admin applies a plan from `/admin`. */
export const PLAN_SOURCE_UPDATED_AT_KEY = "planSourceUpdatedAt";

// ─── Stripe-only billing metadata keys ───────────────────────────────────────
/** Stripe only — plan slug of the active/last Stripe subscription. */
export const BILLING_PLAN_KEY = "billingPlan" as const;
/** Stripe only — Stripe subscription status mapped to a simple set. */
export const BILLING_STATUS_KEY = "billingStatus" as const;
/** Stripe only — ISO timestamp of the last billing state write. */
export const BILLING_PLAN_UPDATED_AT_KEY = "billingPlanUpdatedAt" as const;

// ─── Admin-only metadata keys ─────────────────────────────────────────────────
/** Admin only — plan slug manually assigned by a platform admin. */
export const ADMIN_PLAN_KEY = "adminPlan" as const;
/** Admin only — ISO timestamp of the last admin plan assignment. */
export const ADMIN_PLAN_UPDATED_AT_KEY = "adminPlanUpdatedAt" as const;

export type BillingStatusValue = "active" | "trialing" | "canceled" | "expired";

export type PlanPublicMetadata = {
  /** Resolved/computed display plan — do not write directly; use resolveEffectivePlan(). */
  plan?: unknown;
  teamPlanId?: unknown;
  /** Legacy: ISO timestamp written by admin plan assignment (kept for backward compat). */
  planSourceUpdatedAt?: unknown;
  /** Stripe-sourced plan slug. */
  billingPlan?: unknown;
  /** Stripe subscription status. */
  billingStatus?: unknown;
  /** ISO timestamp of last Stripe billing write. */
  billingPlanUpdatedAt?: unknown;
  /** Admin-assigned plan slug. */
  adminPlan?: unknown;
  /** ISO timestamp of last admin plan assignment. */
  adminPlanUpdatedAt?: unknown;
};

/**
 * Computes the resolved `plan` value from the two independent sources:
 * Stripe billing state and admin assignment.
 *
 * Rules (in order):
 * 1. If billing is canceled/expired AND no admin plan exists → free (null).
 * 2. If billing is canceled/expired AND admin assigned AFTER the cancellation → adminPlan.
 * 3. If billing is canceled/expired AND admin assigned BEFORE or same time → free (null).
 * 4. If billing is active AND both sources exist → whichever timestamp is newer wins.
 * 5. If billing is active with no admin plan → billingPlan.
 * 6. No active billing but adminPlan exists → adminPlan.
 * 7. Nothing → free (null).
 */
export function resolveEffectivePlan(
  meta: Record<string, unknown>,
): string | null {
  const billingPlan =
    typeof meta[BILLING_PLAN_KEY] === "string" ? (meta[BILLING_PLAN_KEY] as string) : null;
  const billingStatus =
    typeof meta[BILLING_STATUS_KEY] === "string" ? (meta[BILLING_STATUS_KEY] as string) : null;
  const billingPlanUpdatedAt =
    typeof meta[BILLING_PLAN_UPDATED_AT_KEY] === "string"
      ? (meta[BILLING_PLAN_UPDATED_AT_KEY] as string)
      : null;
  const adminPlan =
    typeof meta[ADMIN_PLAN_KEY] === "string" && (meta[ADMIN_PLAN_KEY] as string).trim()
      ? (meta[ADMIN_PLAN_KEY] as string).trim()
      : null;
  const adminPlanUpdatedAt =
    typeof meta[ADMIN_PLAN_UPDATED_AT_KEY] === "string"
      ? (meta[ADMIN_PLAN_UPDATED_AT_KEY] as string)
      : null;

  const isBillingActive = billingStatus === "active" || billingStatus === "trialing";
  const isBillingCanceled = billingStatus === "canceled" || billingStatus === "expired";

  if (isBillingCanceled) {
    const billingCanceledMs = parsePlanSourceUpdatedAtMs(billingPlanUpdatedAt) ?? 0;
    const adminAssignedMs = parsePlanSourceUpdatedAtMs(adminPlanUpdatedAt) ?? 0;
    // Admin re-assigned a plan after billing was canceled — honor admin override.
    if (adminPlan && adminAssignedMs > billingCanceledMs) return adminPlan;
    // Billing canceled with no newer admin override → free.
    return null;
  }

  if (isBillingActive && billingPlan) {
    const billingMs = parsePlanSourceUpdatedAtMs(billingPlanUpdatedAt) ?? 0;
    const adminMs = parsePlanSourceUpdatedAtMs(adminPlanUpdatedAt) ?? 0;
    // Admin override is newer than billing event → admin wins.
    if (adminPlan && adminMs > billingMs) return adminPlan;
    return billingPlan;
  }

  // No active billing — fall back to admin plan if present.
  if (adminPlan) return adminPlan;

  return null;
}

type BillingSubscriptionShape = {
  created_at?: number;
  createdAt?: number;
  updated_at?: number;
  updatedAt?: number;
  subscriptionItems?: BillingItemShape[];
};

type BillingItemShape = {
  status?: string;
  plan_id?: string | null;
  planId?: string | null;
  plan?: { id?: string; slug?: string } | null;
  created_at?: number;
  createdAt?: number;
  updated_at?: number;
  updatedAt?: number;
};

function numMs(
  o: Record<string, unknown>,
  snake: string,
  camel: string,
): number {
  const a = o[snake];
  const b = o[camel];
  for (const v of [a, b]) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function isActiveBillingItemStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "active" || s === "trialing";
}

export function metadataPlanSlugFromPublicMeta(
  meta: PlanPublicMetadata | undefined,
): string | undefined {
  if (!meta) return undefined;
  const t = typeof meta.teamPlanId === "string" ? meta.teamPlanId.trim() : "";
  if (t) return t;
  const p = typeof meta.plan === "string" ? meta.plan.trim() : "";
  if (p) return p;
  // Stripe `billingPlan` / admin `adminPlan` may be set before computed `plan` / `teamPlanId` sync.
  const resolved = resolveEffectivePlan(meta as Record<string, unknown>);
  return resolved != null && resolved.trim() !== "" ? resolved.trim() : undefined;
}

export function parsePlanSourceUpdatedAtMs(
  raw: unknown,
): number | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function billingReferenceTimestampMs(
  sub: BillingSubscriptionShape | null | undefined,
): number {
  if (!sub) return 0;
  const root = sub as Record<string, unknown>;
  let max = Math.max(
    numMs(root, "updated_at", "updatedAt"),
    numMs(root, "created_at", "createdAt"),
  );
  for (const raw of sub.subscriptionItems ?? []) {
    const item = raw as Record<string, unknown>;
    max = Math.max(
      max,
      numMs(item, "updated_at", "updatedAt"),
      numMs(item, "created_at", "createdAt"),
    );
  }
  return max;
}

/**
 * Active Clerk Billing product key from subscription items (personal Pro or team tier).
 * Prefers Dashboard `slug` / human-readable keys — Clerk's `plan_id` is often an opaque
 * internal id and must not be shown in admin UI.
 */
export function billingActivePlanSlug(
  sub: BillingSubscriptionShape | null | undefined,
): string | undefined {
  if (!sub?.subscriptionItems?.length) return undefined;
  for (const item of sub.subscriptionItems) {
    const row = item as Record<string, unknown>;
    if (!isActiveBillingItemStatus(item.status)) continue;
    const planField = item.plan;
    const planObj =
      planField && typeof planField === "object"
        ? (planField as { id?: string; slug?: string })
        : null;

    const slugFromPlan =
      typeof planObj?.slug === "string" ? planObj.slug.trim() : "";
    if (slugFromPlan) {
      if (slugFromPlan === "pro" || slugFromPlan === "pro_plus") return slugFromPlan;
      const canonicalTeam = canonicalTeamPlanId(slugFromPlan);
      if (canonicalTeam) return canonicalTeam;
      return slugFromPlan;
    }

    const idFromPlan = typeof planObj?.id === "string" ? planObj.id.trim() : "";
    const pidRaw = row.plan_id ?? row.planId;
    const idFromRow = typeof pidRaw === "string" ? pidRaw.trim() : "";

    for (const candidate of [idFromPlan, idFromRow]) {
      if (!candidate) continue;
      if (candidate === "pro" || candidate === "pro_plus") return candidate;
      const canonicalTeam = canonicalTeamPlanId(candidate);
      if (canonicalTeam) return canonicalTeam;
    }
  }
  return undefined;
}

export async function fetchUserBillingSubscriptionSafe(
  clerkClient: ClerkClient,
  userId: string,
): Promise<BillingSubscriptionShape | null> {
  try {
    return (await clerkClient.billing.getUserBillingSubscription(
      userId,
    )) as BillingSubscriptionShape;
  } catch {
    return null;
  }
}

export type PersonalPlanResolution = {
  /** Team tier taken from the winning source, else null. */
  activeTeamPlan: TeamPlanId | null;
  /** Paid slug implies personal Pro / Pro Plus or team tier (`resolutionFromSlug`). */
  personalPro: boolean;
  /** JWT: subscribed to individual Pro / Pro Plus (never team-tier plan id). */
  billingJwtPersonalPro: boolean;
  /** Raw slug from Billing vs metadata reconciliation (`chosenSlug`) — drives individual tier. */
  effectiveStripeSlug: string | undefined;
  /** Whether metadata `planSourceUpdatedAt` was compared to Billing API timestamps. */
  comparedMetadataToBilling: boolean;
  /** When comparison ran, which side controlled the personal / team tier slug. */
  winner: "billing" | "metadata" | null;
  /** Metadata slug used when JWT had no paid plan (no `planSourceUpdatedAt` on record). */
  legacyMetadataOverride: boolean;
};

type HasFn = (a: { plan: string } | { feature: string }) => boolean | undefined;

function paidPersonalFromHas(has: HasFn): {
  personalPro: boolean;
  personalPaidSlug: "pro" | "pro_plus" | null;
  teamPlan: TeamPlanId | null;
} {
  const hasPro = Boolean(has({ plan: "pro" }));
  const hasProPlus = Boolean(has({ plan: "pro_plus" }));
  let personalPaidSlug: "pro" | "pro_plus" | null = null;
  if (hasProPlus) personalPaidSlug = "pro_plus";
  else if (hasPro) personalPaidSlug = "pro";

  return {
    personalPro: hasPro || hasProPlus,
    personalPaidSlug,
    teamPlan: resolveActiveTeamPlanFromHas(has),
  };
}

function slugImpliesPersonalProOrTeam(slug: string | undefined): boolean {
  if (!slug) return false;
  if (slug === "pro" || slug === "pro_plus") return true;
  if (isEducationPlanId(slug)) return true;
  return isTeamPlanId(slug);
}

/** Active Stripe subscription slug from Clerk `publicMetadata` (not Clerk Billing API). */
export function activeStripeBillingSlugFromMeta(
  meta: PlanPublicMetadata | undefined,
): string | undefined {
  if (!meta) return undefined;
  const status =
    typeof meta.billingStatus === "string" ? meta.billingStatus : null;
  if (status !== "active" && status !== "trialing") return undefined;
  const plan =
    typeof meta.billingPlan === "string" ? meta.billingPlan.trim() : "";
  return plan || undefined;
}

export function stripeBillingReferenceTimestampMs(
  meta: PlanPublicMetadata | undefined,
): number {
  return parsePlanSourceUpdatedAtMs(meta?.billingPlanUpdatedAt) ?? 0;
}

function coalescePaidPlanSlug(
  ...candidates: (string | undefined | null)[]
): string | undefined {
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "free") continue;
    if (slugImpliesPersonalProOrTeam(trimmed)) return trimmed;
  }
  return undefined;
}

/**
 * When `planSourceUpdatedAt` is missing, treat metadata plan flags as the source of
 * entitlements only if Clerk Billing (JWT) does not already show a paid personal or team plan.
 * Covers accounts updated before `planSourceUpdatedAt` existed.
 */
function legacyMetadataOverridesJwt(
  metaSlug: string | undefined,
  has: HasFn,
): boolean {
  if (!slugImpliesPersonalProOrTeam(metaSlug)) return false;
  const jwt = paidPersonalFromHas(has);
  return !jwt.personalPro && jwt.teamPlan === null;
}

function resolutionFromSlug(
  slug: string | undefined,
): Pick<PersonalPlanResolution, "activeTeamPlan" | "personalPro"> {
  if (!slug) {
    return { activeTeamPlan: null, personalPro: false };
  }
  const canonicalTeam = canonicalTeamPlanId(slug);
  if (canonicalTeam) {
    return { activeTeamPlan: canonicalTeam, personalPro: true };
  }
  if (isEducationTeamPlanId(slug)) {
    return { activeTeamPlan: null, personalPro: true };
  }
  if (slug === "pro" || slug === "pro_plus" || slug === "education_plus") {
    return { activeTeamPlan: null, personalPro: true };
  }
  return { activeTeamPlan: null, personalPro: false };
}

/**
 * Decides whether Clerk JWT Billing or `publicMetadata` (admin assigns) is authoritative
 * for personal-workspace plan tier, using `planSourceUpdatedAt` vs Billing subscription timestamps.
 */
export async function resolvePersonalPlanMetadataVsBilling(input: {
  clerkClient: ClerkClient;
  userId: string;
  has: HasFn;
  publicMetadata: PlanPublicMetadata | undefined;
  /** Optional Stripe DB row when Clerk metadata is stale (webhook lag). */
  stripeDbPlanSlug?: string | null;
}): Promise<PersonalPlanResolution> {
  const { clerkClient, userId, has, publicMetadata, stripeDbPlanSlug } = input;
  const metaSlug = metadataPlanSlugFromPublicMeta(publicMetadata);
  const effectiveSlug = resolveEffectivePlan(
    (publicMetadata ?? {}) as Record<string, unknown>,
  );
  const stripeMetaSlug = activeStripeBillingSlugFromMeta(publicMetadata);
  const stripeMetaMs = stripeBillingReferenceTimestampMs(publicMetadata);
  const metaMs = parsePlanSourceUpdatedAtMs(
    publicMetadata?.planSourceUpdatedAt,
  );
  const jwt = paidPersonalFromHas(has);

  let comparedMetadataToBilling = false;
  let winner: "billing" | "metadata" | null = null;
  let chosenSlug: string | undefined;
  let legacyMetadataOverride = false;

  if (metaMs != null) {
    let billingMs = stripeMetaMs;
    let billingSlug = stripeMetaSlug;

    // Legacy Clerk Billing API — only when it reports an active paid item.
    if (!billingSlug) {
      const sub = await fetchUserBillingSubscriptionSafe(clerkClient, userId);
      const clerkSlug = billingActivePlanSlug(sub);
      if (clerkSlug) {
        billingSlug = clerkSlug;
        billingMs = Math.max(billingMs, billingReferenceTimestampMs(sub));
      }
    }

    if (billingMs > 0 || billingSlug) {
      comparedMetadataToBilling = true;
      if (metaMs > billingMs) {
        winner = "metadata";
        chosenSlug = coalescePaidPlanSlug(metaSlug, effectiveSlug);
      } else {
        winner = "billing";
        chosenSlug = coalescePaidPlanSlug(
          billingSlug,
          stripeMetaSlug,
          metaSlug,
          effectiveSlug,
        );
      }
    } else if (jwt.teamPlan !== null) {
      chosenSlug = jwt.teamPlan;
    } else if (jwt.personalPro) {
      chosenSlug = jwt.personalPaidSlug ?? "pro";
    } else if (legacyMetadataOverridesJwt(metaSlug, has)) {
      winner = "metadata";
      chosenSlug = metaSlug;
      legacyMetadataOverride = true;
    } else {
      chosenSlug = coalescePaidPlanSlug(
        stripeMetaSlug,
        effectiveSlug,
        metaSlug,
      );
    }
  } else if (stripeMetaSlug) {
    winner = "billing";
    chosenSlug = stripeMetaSlug;
  } else if (effectiveSlug && slugImpliesPersonalProOrTeam(effectiveSlug)) {
    const adminPlan =
      typeof publicMetadata?.adminPlan === "string"
        ? publicMetadata.adminPlan.trim()
        : "";
    winner = adminPlan && effectiveSlug === adminPlan ? "metadata" : "billing";
    chosenSlug = effectiveSlug;
  } else if (legacyMetadataOverridesJwt(metaSlug, has)) {
    winner = "metadata";
    chosenSlug = metaSlug;
    legacyMetadataOverride = true;
  } else if (jwt.teamPlan !== null) {
    chosenSlug = jwt.teamPlan;
  } else if (jwt.personalPro) {
    chosenSlug = jwt.personalPaidSlug ?? "pro";
  } else {
    chosenSlug = coalescePaidPlanSlug(metaSlug, effectiveSlug);
  }

  chosenSlug = coalescePaidPlanSlug(
    chosenSlug,
    stripeMetaSlug,
    effectiveSlug,
    metaSlug,
    stripeDbPlanSlug,
  );

  const fromSlug = resolutionFromSlug(chosenSlug);
  return {
    ...fromSlug,
    effectiveStripeSlug: chosenSlug,
    billingJwtPersonalPro: jwt.personalPro,
    comparedMetadataToBilling,
    winner,
    legacyMetadataOverride,
  };
}

/** Admin Plan column suffix when metadata was reconciled against Clerk Billing. */
export function augmentAdminPlanLabelWithWinner(
  baseLabel: string,
  input: {
    comparedMetadataToBilling: boolean;
    winner: "billing" | "metadata" | null;
    legacyMetadataOverride: boolean;
  },
): string {
  if (input.legacyMetadataOverride) {
    return `${baseLabel} (admin metadata)`;
  }
  if (input.comparedMetadataToBilling && input.winner) {
    return `${baseLabel} (${input.winner === "metadata" ? "metadata newer" : "subscription newer"})`;
  }
  return baseLabel;
}

/**
 * `/admin` user rows: no JWT `has()` per user — compare `planSourceUpdatedAt` to Billing API only.
 */
export function resolveAdminUserEffectivePlanSlug(input: {
  publicMetadata: PlanPublicMetadata | undefined;
  subscription: BillingSubscriptionShape | null;
}): {
  effectiveSlug: string | undefined;
  comparedMetadataToBilling: boolean;
  winner: "billing" | "metadata" | null;
  legacyMetadataOverride: boolean;
} {
  const metaSlug = metadataPlanSlugFromPublicMeta(input.publicMetadata);
  const metaMs = parsePlanSourceUpdatedAtMs(
    input.publicMetadata?.planSourceUpdatedAt,
  );
  const billingSlug = billingActivePlanSlug(input.subscription);
  const billingMs =
    input.subscription != null
      ? billingReferenceTimestampMs(input.subscription)
      : 0;

  /** Purchased plan in Billing with no `planSourceUpdatedAt` yet — show Billing product key. */
  if (
    metaMs == null &&
    input.subscription != null &&
    billingMs > 0 &&
    billingSlug &&
    !slugImpliesPersonalProOrTeam(metaSlug)
  ) {
    return {
      effectiveSlug: billingSlug,
      comparedMetadataToBilling: false,
      winner: null,
      legacyMetadataOverride: false,
    };
  }

  if (metaMs != null && input.subscription) {
    if (metaMs > billingMs) {
      return {
        effectiveSlug: metaSlug,
        comparedMetadataToBilling: true,
        winner: "metadata",
        legacyMetadataOverride: false,
      };
    }
    return {
      effectiveSlug: billingSlug ?? metaSlug,
      comparedMetadataToBilling: true,
      winner: "billing",
      legacyMetadataOverride: false,
    };
  }

  const legacyMetadataOverride =
    metaMs == null &&
    slugImpliesPersonalProOrTeam(metaSlug) &&
    !slugImpliesPersonalProOrTeam(billingSlug);

  return {
    effectiveSlug: metaSlug,
    comparedMetadataToBilling: false,
    winner: null,
    legacyMetadataOverride,
  };
}
