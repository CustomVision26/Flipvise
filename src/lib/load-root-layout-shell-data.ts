import {
  countUnreadTeamInvitationsForInboxBadge,
  getRootLayoutTeamNavPayload,
  type RootLayoutTeamAdminHeaderTeam,
} from "@/db/queries/teams";
import type { TeamWorkspaceNavTeam } from "@/lib/team-workspace-url";
import { countUnreadAffiliateBroadcastInboxForUser } from "@/db/queries/affiliate-broadcast-inbox";
import { countUnreadSubscriptionCheckoutConfirmationsForUser } from "@/db/queries/subscription-checkout-inbox";
import { countUnreadBillingNoticeInboxForUser } from "@/db/queries/billing-notice-inbox";
import { countUnreadSupportNotificationsForInboxBadge } from "@/db/queries/support-notifications";
import { countUnreadContactUsNotificationsForRecipient } from "@/db/queries/contact-us-notifications";
import { getActiveAffiliateForUser } from "@/db/queries/affiliates";
import type { AccessContext } from "@/lib/access";
import {
  getPersonalWorkspaceAccessLabel,
  getPersonalWorkspaceAccountPlanLabel,
  personalWorkspaceLabelsFromAccessContext,
} from "@/lib/personal-workspace-plan-label";
import { shouldHideHelpCenter } from "@/lib/team-help";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { isTeamPlanId } from "@/lib/team-plans";
import {
  resolveRootLayoutShellProfile,
  rootLayoutShellNeedsAffiliatePortal,
  rootLayoutShellNeedsFullPlanLabels,
  rootLayoutShellNeedsHelpCenterGate,
  rootLayoutShellNeedsInboxBadge,
  rootLayoutShellNeedsTeamNav,
  type RootLayoutShellProfile,
} from "@/lib/root-layout-route-kind";
const EMPTY_TEAM_NAV = {
  teamAdminHeaderTeams: [] as RootLayoutTeamAdminHeaderTeam[],
  workspaceNav: { teams: [] as TeamWorkspaceNavTeam[], totalEligibleCount: 0 },
  teamMembershipCount: 0,
};

export type RootLayoutTeamDashFallback = {
  teamId: number;
  planSlug: string;
  teamMemberUrlParam: number;
} | null;

export type RootLayoutShellData = {
  profile: RootLayoutShellProfile;
  teamAdminHeaderTeams: RootLayoutTeamAdminHeaderTeam[];
  workspaceTeams: TeamWorkspaceNavTeam[];
  workspaceTeamsTotalEligible: number;
  hideHelpCenter: boolean;
  inboxUnreadCount: number;
  showAffiliatePortal: boolean;
  personalPlanLabelForWorkspace: string;
  personalAccountPlanLabel: string;
  showWorkspaceSwitcher: boolean;
  teamDashFallback: RootLayoutTeamDashFallback;
};

function resolveTeamDashFallback(
  userId: string | null,
  activeTeamPlan: AccessContext["activeTeamPlan"],
  workspaceTeams: TeamWorkspaceNavTeam[],
): RootLayoutTeamDashFallback {
  if (
    userId == null ||
    activeTeamPlan == null ||
    !isTeamPlanId(activeTeamPlan)
  ) {
    return null;
  }
  // Personal "Team Admin Dash": subscriber with an active team-tier personal plan who owns team workspaces.
  const ownedTeamTierTeams = workspaceTeams.filter(
    (t) => t.isSubscriberOwned && isTeamPlanId(t.planUrlValue),
  );
  if (ownedTeamTierTeams.length === 0) {
    return null;
  }
  const match = ownedTeamTierTeams.find(
    (t) => t.planUrlValue === activeTeamPlan,
  );
  const pick = match ?? ownedTeamTierTeams[0]!;
  return {
    teamId: pick.id,
    planSlug: pick.planUrlValue,
    teamMemberUrlParam: pick.teamMemberUrlParam,
  };
}

function resolveShowWorkspaceSwitcher(
  workspaceTeamsTotalEligible: number,
  activeTeamPlan: AccessContext["activeTeamPlan"],
  isPro: boolean,
  hasTeamMembership: boolean,
): boolean {
  return (
    workspaceTeamsTotalEligible > 0 ||
    hasTeamMembership ||
    (activeTeamPlan != null && isTeamPlanId(activeTeamPlan)) ||
    isPro
  );
}

export async function loadRootLayoutShellData(input: {
  pathname: string;
  access: AccessContext;
  teamContextCookie: string | undefined;
}): Promise<RootLayoutShellData> {
  const { pathname, access, teamContextCookie } = input;
  const profile = resolveRootLayoutShellProfile(pathname, access.userId);
  const { userId, isAdmin, adminGranted, activeTeamPlan, isPro, primaryEmail } =
    access;

  const emptyGuest: RootLayoutShellData = {
    profile,
    teamAdminHeaderTeams: [],
    workspaceTeams: [],
    workspaceTeamsTotalEligible: 0,
    hideHelpCenter: false,
    inboxUnreadCount: 0,
    showAffiliatePortal: false,
    personalPlanLabelForWorkspace: "Free",
    personalAccountPlanLabel: "Free",
    showWorkspaceSwitcher: false,
    teamDashFallback: null,
  };

  if (profile === "guest" || userId == null) {
    return emptyGuest;
  }

  const needsTeamNav = rootLayoutShellNeedsTeamNav(profile);
  const needsInbox = rootLayoutShellNeedsInboxBadge(profile);
  const needsAffiliate = rootLayoutShellNeedsAffiliatePortal(profile);
  const needsFullPlanLabels = rootLayoutShellNeedsFullPlanLabels(profile);
  const needsHelpGate = rootLayoutShellNeedsHelpCenterGate(
    profile,
    isAdmin,
    adminGranted,
  );

  const emailLower = primaryEmail?.toLowerCase() ?? null;

  const [teamNavPayload, hideHelpCenter, inboxUnreadCount, activeAffiliateRow] =
    await Promise.all([
      needsTeamNav
        ? tryTeamQuery(
            () =>
              getRootLayoutTeamNavPayload(userId, {
                personalProUnlocked: isPro,
              }),
            EMPTY_TEAM_NAV,
          )
        : Promise.resolve(EMPTY_TEAM_NAV),

      needsHelpGate
        ? shouldHideHelpCenter(userId, teamContextCookie)
        : Promise.resolve(false),

      needsInbox
        ? Promise.all([
            primaryEmail != null && primaryEmail !== ""
              ? tryTeamQuery(
                  () =>
                    countUnreadTeamInvitationsForInboxBadge(primaryEmail, userId),
                  0,
                )
              : Promise.resolve(0),
            tryTeamQuery(
              () => countUnreadAffiliateBroadcastInboxForUser(userId),
              0,
            ),
            countUnreadSubscriptionCheckoutConfirmationsForUser(userId).catch(
              () => 0,
            ),
            countUnreadBillingNoticeInboxForUser(userId).catch(() => 0),
            countUnreadSupportNotificationsForInboxBadge(userId).catch(() => 0),
            isAdmin
              ? countUnreadContactUsNotificationsForRecipient(userId).catch(() => 0)
              : Promise.resolve(0),
          ]).then(
            ([invites, affiliateBroadcasts, subscriptionConfirmations, billingNotices, supportAlerts, contactUsAlerts]) =>
              invites +
              affiliateBroadcasts +
              subscriptionConfirmations +
              billingNotices +
              supportAlerts +
              contactUsAlerts,
          )
        : Promise.resolve(0),

      needsAffiliate
        ? getActiveAffiliateForUser(userId, emailLower).catch(() => null)
        : Promise.resolve(null),
    ]);

  const teamAdminHeaderTeams = teamNavPayload.teamAdminHeaderTeams;
  const workspaceTeams = teamNavPayload.workspaceNav.teams;
  const workspaceTeamsTotalEligible =
    teamNavPayload.workspaceNav.totalEligibleCount;
  const hasTeamMembership = teamNavPayload.teamMembershipCount > 0;

  const planLabels = needsFullPlanLabels
    ? {
        personalPlanLabelForWorkspace: await getPersonalWorkspaceAccessLabel().catch(
          () =>
            personalWorkspaceLabelsFromAccessContext(access)
              .personalPlanLabelForWorkspace,
        ),
        personalAccountPlanLabel: await getPersonalWorkspaceAccountPlanLabel().catch(
          () =>
            personalWorkspaceLabelsFromAccessContext(access).personalAccountPlanLabel,
        ),
      }
    : personalWorkspaceLabelsFromAccessContext(access);

  return {
    profile,
    teamAdminHeaderTeams,
    workspaceTeams,
    workspaceTeamsTotalEligible,
    hideHelpCenter,
    inboxUnreadCount,
    showAffiliatePortal: activeAffiliateRow != null,
    personalPlanLabelForWorkspace: planLabels.personalPlanLabelForWorkspace,
    personalAccountPlanLabel: planLabels.personalAccountPlanLabel,
    showWorkspaceSwitcher: resolveShowWorkspaceSwitcher(
      workspaceTeamsTotalEligible,
      activeTeamPlan,
      isPro,
      hasTeamMembership,
    ),
    teamDashFallback: resolveTeamDashFallback(
      userId,
      activeTeamPlan,
      workspaceTeams,
    ),
  };
}
