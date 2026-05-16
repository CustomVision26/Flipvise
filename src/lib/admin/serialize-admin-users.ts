import type { User } from "@clerk/backend";
import type { SerializedUser } from "@/lib/admin-dashboard-types";
import { getAdminUserPlanColumnLabel } from "@/lib/admin-user-plan-label";
import {
  augmentAdminPlanLabelWithWinner,
  metadataPlanSlugFromPublicMeta,
  parsePlanSourceUpdatedAtMs,
  resolveEffectivePlan,
  type PlanPublicMetadata,
} from "@/lib/plan-metadata-billing-resolution";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import { buildTeamWorkspaceDashboardPath } from "@/lib/team-workspace-url";
import { canonicalTeamPlanId, isTeamPlanId, limitsForPlan } from "@/lib/team-plans";
import type { getDeckStatsByUser, getWorkspaceDetailsByOwnerUserIds } from "@/db/queries/admin";
import type { UserTeamPlanAdminRow } from "@/db/queries/admin";

type ClerkUserMeta = PlanPublicMetadata & {
  role?: string;
  stripe_subscription_status?: string;
  adminGranted?: boolean;
};

function adminPlanLabelFromSlug(slug: string | undefined): string {
  return displayNameForBillingPlanSlug(slug ?? null);
}

function resolveCurrentPersonalPlanStartTimeIso(input: {
  adminAssignedAtMs: number | null;
  billingReferenceMs: number;
}): string {
  const nowMs = Date.now();
  const adminMs =
    input.adminAssignedAtMs != null && Number.isFinite(input.adminAssignedAtMs)
      ? input.adminAssignedAtMs
      : null;
  const billingMs =
    Number.isFinite(input.billingReferenceMs) && input.billingReferenceMs > 0
      ? input.billingReferenceMs
      : null;

  const adminValid = adminMs != null && adminMs <= nowMs ? adminMs : null;
  const billingValid = billingMs != null && billingMs <= nowMs ? billingMs : null;

  let chosenMs: number | null = null;
  if (adminValid != null && billingValid != null) {
    chosenMs = Math.max(adminValid, billingValid);
  } else if (adminValid != null) {
    chosenMs = adminValid;
  } else if (billingValid != null) {
    chosenMs = billingValid;
  } else if (adminMs != null && billingMs != null) {
    chosenMs = Math.max(adminMs, billingMs);
  } else if (adminMs != null) {
    chosenMs = adminMs;
  } else if (billingMs != null) {
    chosenMs = billingMs;
  }

  return chosenMs != null ? new Date(chosenMs).toISOString() : new Date(nowMs).toISOString();
}

function billingReferenceMsFromMetadata(meta: ClerkUserMeta): number {
  return parsePlanSourceUpdatedAtMs(meta.billingPlanUpdatedAt) ?? 0;
}

function planResolutionFromMetadata(meta: ClerkUserMeta) {
  const stripeResolved = resolveEffectivePlan(meta as Record<string, unknown>);
  const metaSlug = metadataPlanSlugFromPublicMeta(meta);
  const effectiveSlug = stripeResolved ?? metaSlug;
  return {
    effectiveSlug: effectiveSlug ?? undefined,
    comparedMetadataToBilling: false,
    winner: null as "billing" | "metadata" | null,
    legacyMetadataOverride: false,
  };
}

function stripeActivePlanSlug(meta: ClerkUserMeta): string | undefined {
  const active =
    meta.billingStatus === "active" || meta.billingStatus === "trialing";
  if (!active) return undefined;
  const fromStripe = resolveEffectivePlan(meta as Record<string, unknown>);
  if (fromStripe) return fromStripe;
  if (typeof meta.billingPlan === "string" && meta.billingPlan.trim()) {
    return meta.billingPlan.trim();
  }
  return undefined;
}

export type SerializeAdminUsersContext = {
  clerkUsers: User[];
  deckStatsByUser: Awaited<ReturnType<typeof getDeckStatsByUser>>;
  teamPlanByUserId: Map<string, UserTeamPlanAdminRow>;
  teamOwnerPlanByUserId: Map<string, string | null>;
  teamOwnerPlanSlugsByUserId: Map<string, string[]>;
  teamWorkspaceCountsByOwnerUserId: Map<string, number>;
  teamInviteeTotalsByOwnerUserId: Map<string, number>;
  workspaceDetailsByOwnerUserId: Awaited<
    ReturnType<typeof getWorkspaceDetailsByOwnerUserIds>
  >;
  activeSessionData: Map<string, number>;
  includeWorkspaceDetails: boolean;
};

export function serializeAdminUsers(ctx: SerializeAdminUsersContext): SerializedUser[] {
  const statsByUserId = new Map(ctx.deckStatsByUser.map((s) => [s.userId, s]));

  return ctx.clerkUsers.map((user) => {
    const primaryEmail =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? null;

    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      "—";

    const meta = user.publicMetadata as ClerkUserMeta;

    const isSuperadmin =
      meta?.role === "superadmin" || isPlatformSuperadminAllowListed(user.id);
    const isCoAdmin = meta?.role === "admin";
    const isAdmin = isCoAdmin || isSuperadmin;
    const isBanned = user.banned === true;

    const planResolutionAdmin = planResolutionFromMetadata(meta);
    const planOrTeamSlug = planResolutionAdmin.effectiveSlug;
    const adminAssignedAtMs = parsePlanSourceUpdatedAtMs(meta?.planSourceUpdatedAt);
    const billingReferenceMs = billingReferenceMsFromMetadata(meta);
    const currentPersonalPlanDateTime = resolveCurrentPersonalPlanStartTimeIso({
      adminAssignedAtMs,
      billingReferenceMs,
    });
    const hasAdminPlanDate =
      adminAssignedAtMs != null && Number.isFinite(adminAssignedAtMs);
    const hasBillingDate =
      Number.isFinite(billingReferenceMs) && billingReferenceMs > 0;
    const planSetAt =
      hasAdminPlanDate || hasBillingDate ? currentPersonalPlanDateTime : null;
    const metadataAssignedSlug = metadataPlanSlugFromPublicMeta(meta);
    const clerkCurrentSlug = stripeActivePlanSlug(meta) ?? metadataAssignedSlug;

    const isPaidPro =
      planOrTeamSlug === "pro" ||
      planOrTeamSlug === "pro_plus" ||
      (planOrTeamSlug != null &&
        planOrTeamSlug.length > 0 &&
        isTeamPlanId(planOrTeamSlug)) ||
      meta?.stripe_subscription_status === "active";
    const adminGranted = meta?.adminGranted === true;
    const isPro = isPaidPro || adminGranted || isAdmin;
    const associatePlan = ctx.teamPlanByUserId.get(user.id)?.label ?? null;
    const fromClerk = getAdminUserPlanColumnLabel({
      isSuperadmin,
      isCoAdmin,
      adminGranted,
      planMeta: planOrTeamSlug,
      stripeSubscriptionActive: meta?.stripe_subscription_status === "active",
    });
    const withAssociateFallback =
      fromClerk !== "Free" ? fromClerk : (ctx.teamOwnerPlanByUserId.get(user.id) ?? "Free");
    const planDisplayName = augmentAdminPlanLabelWithWinner(withAssociateFallback, {
      comparedMetadataToBilling: planResolutionAdmin.comparedMetadataToBilling,
      winner: planResolutionAdmin.winner,
      legacyMetadataOverride: planResolutionAdmin.legacyMetadataOverride,
    });
    const roleAutoProLabel = isAdmin ? "Pro" : null;
    const nonFreePlanFallback =
      roleAutoProLabel ?? (withAssociateFallback !== "Free" ? withAssociateFallback : null);
    const clerkPlanLabel = adminPlanLabelFromSlug(clerkCurrentSlug);
    const adminAssignedPlanLabel = metadataAssignedSlug
      ? adminPlanLabelFromSlug(metadataAssignedSlug)
      : "";
    const currentPersonalPlanLabelRaw = augmentAdminPlanLabelWithWinner(
      adminPlanLabelFromSlug(planOrTeamSlug),
      {
        comparedMetadataToBilling: planResolutionAdmin.comparedMetadataToBilling,
        winner: planResolutionAdmin.winner,
        legacyMetadataOverride: planResolutionAdmin.legacyMetadataOverride,
      },
    );
    const currentPersonalPlanLabel =
      currentPersonalPlanLabelRaw.startsWith("Free") && nonFreePlanFallback != null
        ? nonFreePlanFallback
        : currentPersonalPlanLabelRaw;
    const activeSessionCount = !isBanned ? (ctx.activeSessionData.get(user.id) ?? 0) : 0;
    const isOnline = activeSessionCount > 0;
    const ownedTeamPlanSlugs = (ctx.teamOwnerPlanSlugsByUserId.get(user.id) ?? []).filter(
      isTeamPlanId,
    );
    const fallbackOwnedTeamSlug =
      ownedTeamPlanSlugs.length > 0 ? ownedTeamPlanSlugs[0] : null;
    const liveBillingTeamSlug = (() => {
      const s = stripeActivePlanSlug(meta);
      return s != null && isTeamPlanId(s) ? s : null;
    })();
    const teamTierPlanSlug = isTeamPlanId(planOrTeamSlug ?? "")
      ? (planOrTeamSlug ?? null)
      : (liveBillingTeamSlug ?? fallbackOwnedTeamSlug);
    const workspaceCreatedCount = ctx.teamWorkspaceCountsByOwnerUserId.get(user.id) ?? 0;
    const workspaceTotalCount =
      teamTierPlanSlug == null ? null : limitsForPlan(teamTierPlanSlug).maxTeams;
    const workspaceRemainingCount =
      teamTierPlanSlug == null
        ? null
        : Math.max((workspaceTotalCount ?? 0) - workspaceCreatedCount, 0);
    const totalInviteesCount = ctx.teamInviteeTotalsByOwnerUserId.get(user.id) ?? 0;

    const workspaces = ctx.includeWorkspaceDetails
      ? (ctx.workspaceDetailsByOwnerUserId.get(user.id) ?? []).map((workspace) => ({
          id: workspace.teamId,
          name: workspace.teamName,
          href: buildTeamWorkspaceDashboardPath({
            teamId: workspace.teamId,
            ownerUserId: user.id,
            planSlug: canonicalTeamPlanId(workspace.planSlug) ?? workspace.planSlug,
            teamMemberUrlParam: 0,
          }),
          ownerName: fullName,
          inviteeTotal: workspace.inviteeTotal,
          inviteeAdminTotal: workspace.inviteeAdminTotal,
          inviteeMemberTotal: workspace.inviteeMemberTotal,
          deckTotal: workspace.deckTotal,
          cardTotal: workspace.cardTotal,
          invitees: workspace.invitees.map((invitee) => {
            const inviteeUser =
              invitee.userId != null
                ? ctx.clerkUsers.find((u) => u.id === invitee.userId)
                : null;
            const inviteeNameFromClerk = inviteeUser
              ? [inviteeUser.firstName, inviteeUser.lastName].filter(Boolean).join(" ") ||
                inviteeUser.username ||
                null
              : null;
            const inviteePrimaryEmail = inviteeUser
              ? (inviteeUser.emailAddresses.find(
                  (e) => e.id === inviteeUser.primaryEmailAddressId,
                )?.emailAddress ?? null)
              : null;
            const resolvedEmail = invitee.email ?? inviteePrimaryEmail;
            return {
              userId: invitee.userId,
              name: inviteeNameFromClerk,
              email: resolvedEmail,
              role:
                invitee.role === "team_admin" ? ("admin" as const) : ("member" as const),
              membershipStatus: invitee.membershipStatus,
              assignedDeckNames: invitee.assignedDeckNames,
            };
          }),
        }))
      : [];

    const userStats = statsByUserId.get(user.id);

    return {
      id: user.id,
      fullName,
      email: primaryEmail,
      isSuperadmin,
      isAdmin,
      isBanned,
      isPaidPro,
      adminGranted,
      isPro,
      clerkPlan: clerkPlanLabel,
      adminAssignedPlan: adminAssignedPlanLabel,
      currentPersonalPlan: currentPersonalPlanLabel,
      currentPersonalPlanDateTime,
      planDisplayName,
      associatePlan,
      isOnline,
      activeSessionCount,
      teamTierPlanSlug,
      workspaceCreatedCount,
      workspaceTotalCount,
      workspaceRemainingCount,
      totalInviteesCount,
      workspaces,
      lastUpdated: userStats?.lastUpdated?.toISOString() ?? null,
      planSetAt,
      createdAt: new Date(user.createdAt).toISOString(),
      lastSignInAt: user.lastSignInAt
        ? new Date(user.lastSignInAt).toISOString()
        : null,
      billingPlan:
        typeof meta.billingPlan === "string" ? meta.billingPlan : null,
      billingStatus:
        typeof meta.billingStatus === "string" ? meta.billingStatus : null,
      billingPlanUpdatedAt:
        typeof meta.billingPlanUpdatedAt === "string"
          ? meta.billingPlanUpdatedAt
          : null,
      adminPlan: typeof meta.adminPlan === "string" ? meta.adminPlan : null,
      adminPlanUpdatedAt:
        typeof meta.adminPlanUpdatedAt === "string" ? meta.adminPlanUpdatedAt : null,
    };
  });
}

export function countAdminGrantedProPlus(clerkUsers: User[]): number {
  let adminApprovedCount = 0;
  let adminRoleProCount = 0;

  for (const u of clerkUsers) {
    const meta = u.publicMetadata as {
      role?: string;
      adminGranted?: boolean;
      billingPlan?: string;
      billingStatus?: string;
    };
    const stripeActive =
      meta?.billingStatus === "active" || meta?.billingStatus === "trialing";
    const effectiveSlug = stripeActive
      ? (resolveEffectivePlan(meta as Record<string, unknown>) ?? meta?.billingPlan ?? null)
      : null;
    const isPaidPro =
      effectiveSlug === "pro" ||
      effectiveSlug === "pro_plus" ||
      isTeamPlanId(effectiveSlug ?? "");
    const isAdminGranted = meta?.adminGranted === true;
    const isAdminRole = meta?.role === "admin" || meta?.role === "superadmin";

    if (isPaidPro) continue;
    if (isAdminGranted) adminApprovedCount++;
    else if (isAdminRole) adminRoleProCount++;
  }

  return adminApprovedCount + adminRoleProCount;
}
