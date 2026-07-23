import type { User } from "@clerk/backend";
import type { SerializedUser } from "@/lib/admin-dashboard-types";
import {
  getAdminUserPlanColumnLabel,
  resolveAdminUserPlanAccessType,
  resolveAdminUserPlanBillingContext,
  resolveAdminUserPlanDisplayName,
} from "@/lib/admin-user-plan-label";
import {
  augmentAdminPlanLabelWithWinner,
  metadataPlanSlugFromPublicMeta,
  parsePlanSourceUpdatedAtMs,
  type PlanPublicMetadata,
} from "@/lib/plan-metadata-billing-resolution";
import {
  SECURITY_QUESTION_LABELS,
  formatMailingAddress,
  parseMailingAddressFromPublicMetadata,
  parseSecurityQuestionsFromPrivateMetadata,
  type SecurityQuestionId,
} from "@/lib/account-recovery-profile";
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
  recoveryPhone?: string;
  mailingAddress?: unknown;
  accountType?: string;
  organizationName?: string;
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
  const planCtx = resolveAdminUserPlanBillingContext(meta);
  return {
    effectiveSlug: planCtx.effectivePlanSlug ?? undefined,
    comparedMetadataToBilling: false,
    winner: null as "billing" | "metadata" | null,
    legacyMetadataOverride: false,
  };
}

function stripeActivePlanSlug(meta: ClerkUserMeta): string | undefined {
  const planCtx = resolveAdminUserPlanBillingContext(meta);
  if (planCtx.stripeAuthoritative && planCtx.billingPlanSlug) {
    return planCtx.billingPlanSlug;
  }
  if (planCtx.isBillingActive && planCtx.resolvedSlug) {
    return planCtx.resolvedSlug;
  }
  if (typeof meta.billingPlan === "string" && meta.billingPlan.trim()) {
    const active =
      meta.billingStatus === "active" || meta.billingStatus === "trialing";
    if (active) return meta.billingPlan.trim();
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
  /** Active marketing-affiliate user ids (Clerk user id or email-linked). */
  activeAffiliateUserIds?: Set<string>;
  /** Latest admin profile-dialog access time by Clerk user id. */
  lastAdminProfileAccessByUserId?: Map<string, Date>;
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
    const privateMeta = user.privateMetadata as Record<string, unknown>;
    const securityEntries = parseSecurityQuestionsFromPrivateMetadata(privateMeta);
    const securityQuestions = securityEntries
      ? securityEntries.map((entry) => ({
          question:
            SECURITY_QUESTION_LABELS[entry.questionId as SecurityQuestionId] ??
            entry.questionId,
          answer: entry.answer,
        }))
      : null;

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
    const planAccessType = resolveAdminUserPlanAccessType({
      meta,
      isSuperadmin,
      isCoAdmin,
      isActiveAffiliate: ctx.activeAffiliateUserIds?.has(user.id) ?? false,
    });
    const planCtx = resolveAdminUserPlanBillingContext(meta);
    const ownedTeamPlanLabel = ctx.teamOwnerPlanByUserId.get(user.id) ?? null;
    const planColumnLabel = resolveAdminUserPlanDisplayName({
      clerkColumnLabel: fromClerk,
      planAccessType,
      ownedTeamPlanLabel,
      planCtx,
    });
    const planDisplayName = augmentAdminPlanLabelWithWinner(planColumnLabel, {
      comparedMetadataToBilling: planResolutionAdmin.comparedMetadataToBilling,
      winner: planResolutionAdmin.winner,
      legacyMetadataOverride: planResolutionAdmin.legacyMetadataOverride,
    });
    const roleAutoProLabel = isAdmin ? "Pro" : null;
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
      planAccessType === "Free"
        ? "Free"
        : currentPersonalPlanLabelRaw.startsWith("Free") && roleAutoProLabel != null
          ? roleAutoProLabel
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
      planAccessType,
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
      phoneNumber:
        typeof meta.recoveryPhone === "string" && meta.recoveryPhone.trim()
          ? meta.recoveryPhone.trim()
          : null,
      mailingAddress:
        formatMailingAddress(
          parseMailingAddressFromPublicMetadata(
            meta as Record<string, unknown>,
          ),
        ) || null,
      accountType:
        typeof meta.accountType === "string" && meta.accountType.trim()
          ? meta.accountType.trim()
          : null,
      organizationName:
        typeof meta.organizationName === "string" && meta.organizationName.trim()
          ? meta.organizationName.trim()
          : null,
      securityQuestions,
      lastAdminProfileAccessAt:
        ctx.lastAdminProfileAccessByUserId?.get(user.id)?.toISOString() ?? null,
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
    const meta = u.publicMetadata as ClerkUserMeta;
    const planCtx = resolveAdminUserPlanBillingContext(meta);
    const isPaidPro =
      planCtx.stripeAuthoritative ||
      (planCtx.effectivePlanSlug != null &&
        (planCtx.effectivePlanSlug === "pro" ||
          planCtx.effectivePlanSlug === "pro_plus" ||
          isTeamPlanId(planCtx.effectivePlanSlug)));
    const isAdminGranted = meta?.adminGranted === true;
    const isAdminRole = meta?.role === "admin" || meta?.role === "superadmin";

    if (isPaidPro) continue;
    if (isAdminGranted) adminApprovedCount++;
    else if (isAdminRole) adminRoleProCount++;
  }

  return adminApprovedCount + adminRoleProCount;
}
