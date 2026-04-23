import type { ClerkClient } from "@clerk/backend";
import {
  TEAM_PLAN_LABELS,
  isTeamPlanId,
  resolveActiveTeamPlanFromHas,
  type TeamPlanId,
} from "@/lib/team-plans";

/** ISO timestamp written whenever an admin applies a plan from `/admin`. */
export const PLAN_SOURCE_UPDATED_AT_KEY = "planSourceUpdatedAt";

export type PlanPublicMetadata = {
  plan?: unknown;
  teamPlanId?: unknown;
  planSourceUpdatedAt?: unknown;
};

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
  const p = typeof meta.plan === "string" ? meta.plan.trim() : "";
  if (p) return p;
  const t = typeof meta.teamPlanId === "string" ? meta.teamPlanId.trim() : "";
  return t || undefined;
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
    if (slugFromPlan) return slugFromPlan;

    const idFromPlan = typeof planObj?.id === "string" ? planObj.id.trim() : "";
    const pidRaw = row.plan_id ?? row.planId;
    const idFromRow = typeof pidRaw === "string" ? pidRaw.trim() : "";

    for (const candidate of [idFromPlan, idFromRow]) {
      if (!candidate) continue;
      if (candidate === "pro" || isTeamPlanId(candidate)) return candidate;
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
  /** Personal Pro (`plan === "pro"`) from the winning source (no team tier). */
  personalPro: boolean;
  /** JWT / Clerk Billing `has({ plan: "pro" })` before metadata reconciliation. */
  billingJwtPersonalPro: boolean;
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
  teamPlan: TeamPlanId | null;
} {
  return {
    personalPro: Boolean(has({ plan: "pro" })),
    teamPlan: resolveActiveTeamPlanFromHas(has),
  };
}

function slugImpliesPersonalProOrTeam(slug: string | undefined): boolean {
  if (!slug) return false;
  if (slug === "pro") return true;
  return isTeamPlanId(slug);
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
  const { personalPro, teamPlan } = paidPersonalFromHas(has);
  return !personalPro && teamPlan === null;
}

function resolutionFromSlug(
  slug: string | undefined,
): Pick<PersonalPlanResolution, "activeTeamPlan" | "personalPro"> {
  if (!slug) {
    return { activeTeamPlan: null, personalPro: false };
  }
  if (isTeamPlanId(slug)) {
    return { activeTeamPlan: slug, personalPro: true };
  }
  if (slug === "pro") {
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
}): Promise<PersonalPlanResolution> {
  const { clerkClient, userId, has, publicMetadata } = input;
  const metaSlug = metadataPlanSlugFromPublicMeta(publicMetadata);
  const metaMs = parsePlanSourceUpdatedAtMs(
    publicMetadata?.planSourceUpdatedAt,
  );
  const jwt = paidPersonalFromHas(has);

  let comparedMetadataToBilling = false;
  let winner: "billing" | "metadata" | null = null;
  let chosenSlug: string | undefined;
  let legacyMetadataOverride = false;

  if (metaMs != null) {
    const sub = await fetchUserBillingSubscriptionSafe(clerkClient, userId);
    if (sub) {
      comparedMetadataToBilling = true;
      const billingMs = billingReferenceTimestampMs(sub);
      const billingSlug = billingActivePlanSlug(sub);
      if (metaMs > billingMs) {
        winner = "metadata";
        chosenSlug = metaSlug;
      } else {
        winner = "billing";
        chosenSlug = billingSlug;
      }
    } else {
      if (jwt.teamPlan !== null) {
        chosenSlug = jwt.teamPlan;
      } else if (jwt.personalPro) {
        chosenSlug = "pro";
      } else if (legacyMetadataOverridesJwt(metaSlug, has)) {
        winner = "metadata";
        chosenSlug = metaSlug;
        legacyMetadataOverride = true;
      } else {
        chosenSlug = undefined;
      }
    }
  } else if (legacyMetadataOverridesJwt(metaSlug, has)) {
    winner = "metadata";
    chosenSlug = metaSlug;
    legacyMetadataOverride = true;
  } else {
    if (jwt.teamPlan !== null) {
      chosenSlug = jwt.teamPlan;
    } else if (jwt.personalPro) {
      chosenSlug = "pro";
    } else {
      chosenSlug = undefined;
    }
  }

  const fromSlug = resolutionFromSlug(chosenSlug);
  return {
    ...fromSlug,
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
