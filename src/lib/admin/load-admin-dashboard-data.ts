import {
  getAdminOverviewStats,
  getAdminPrivilegeLogs,
  getAdminPlanAssignmentLogs,
  getDeckStatsByUser,
  getTeamOwnerPlanLabelsByUserIds,
  getTeamOwnerPlanSlugsByUserIds,
  getUserTeamPlanAssociationsByUserIds,
  getTeamWorkspaceCountsByOwnerUserIds,
  getTeamInviteeTotalsByOwnerUserIds,
  getWorkspaceDetailsByOwnerUserIds,
} from "@/db/queries/admin";
import { countPaidSubscribersFromDB, listBillingInvoicesForAdmin } from "@/db/queries/billing";
import { listAffiliates } from "@/db/queries/affiliates";
import { evaluateAllActiveAffiliateQuotas } from "@/lib/affiliate-quota-renewal";
import { listStripeSubscriptionsForAdmin } from "@/db/queries/stripe-subscriptions";
import { getAllSupportTickets, getSupportTicketStats } from "@/db/queries/support";
import type { AdminDashboardSection } from "@/lib/admin-dashboard-section";
import { getAdminClerkUserList } from "@/lib/admin/admin-clerk-cache";
import {
  buildActiveAffiliateUserIds,
  buildAdminBillingSnapshot,
  clerkUsersToBillingMeta,
} from "@/lib/admin/admin-billing-snapshot";
import type { AdminBillingUserMeta } from "@/lib/admin/admin-billing-snapshot";
import { getActiveSessionData } from "@/lib/admin/get-active-session-data";
import { readPlansConfig } from "@/lib/admin/read-plans-config";
import {
  ADMIN_DASHBOARD_DB_CONCURRENCY,
  runDbTasksWithConcurrencyLimit,
} from "@/lib/admin/run-db-tasks";
import { countAdminGrantedProPlus, serializeAdminUsers } from "@/lib/admin/serialize-admin-users";
import type {
  SerializedAdminInvoice,
  SerializedAdminSubscription,
  SerializedAffiliate,
  SerializedLog,
  SerializedPlanAssignmentLog,
  SerializedUser,
} from "@/lib/admin-dashboard-types";
import {
  serializeSupportTicketRow,
  type SerializedTicket,
  type SupportStats,
} from "@/lib/support-admin-dto";
import type { PlanConfig } from "@/components/pricing-content";

const OVERVIEW_INVOICE_LIMIT = 500;
const INVOICES_TAB_LIMIT = 2000;

function serializeAffiliatesForAdmin(
  rawAffiliates: Awaited<ReturnType<typeof listAffiliates>>,
): SerializedAffiliate[] {
  return rawAffiliates.map((a) => ({
    id: a.id,
    invitedEmail: a.invitedEmail,
    invitedUserId: a.invitedUserId ?? null,
    affiliateName: a.affiliateName,
    planAssigned: a.planAssigned,
    startedAt: a.startedAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    inviteExpiresAt: a.inviteExpiresAt.toISOString(),
    addedByUserId: a.addedByUserId,
    addedByName: a.addedByName,
    status: a.status as SerializedAffiliate["status"],
    token: null,
    inviteAcceptedAt: a.inviteAcceptedAt ? a.inviteAcceptedAt.toISOString() : null,
    revokedAt: a.revokedAt ? a.revokedAt.toISOString() : null,
    revokedByName: a.revokedByName ?? null,
    createdAt: a.createdAt.toISOString(),
    promotionalCode: a.promotionalCode,
    paidReferralsTotal: a.paidReferralsTotal ?? 0,
    paidReferralsMonth: a.paidReferralsMonth ?? 0,
    paidReferralsMonthKey: a.paidReferralsMonthKey ?? null,
    referralQuotaEnabled: a.referralQuotaEnabled ?? false,
    referralQuotaTarget: a.referralQuotaTarget ?? null,
    periodPaidReferrals: a.periodPaidReferrals ?? 0,
    quotaPeriodStartedAt: a.quotaPeriodStartedAt?.toISOString() ?? null,
    pendingPlanAssigned: a.pendingPlanAssigned ?? null,
    pendingEndsAt: a.pendingEndsAt?.toISOString() ?? null,
    arrangementChangeExpiresAt: a.arrangementChangeExpiresAt?.toISOString() ?? null,
  }));
}

export type AdminOverviewData = {
  totalUsers: number;
  totalDecks: number;
  totalCards: number;
  adminGrantedProPlusCount: number;
  paidSubscriberCount: number;
  dbPaidSubscriberCount: number;
  subscriptions: SerializedAdminSubscription[];
  invoices: SerializedAdminInvoice[];
};

export async function loadAdminOverviewData(): Promise<AdminOverviewData> {
  const [
    { data: clerkUsers, totalCount },
    dbStats,
    dbPaidSubscriberCount,
    persistedBillingInvoices,
    rawAffiliates,
    stripeSubscriptions,
  ] = await runDbTasksWithConcurrencyLimit(
    [
      () => getAdminClerkUserList(),
      () => getAdminOverviewStats(),
      () => countPaidSubscribersFromDB(),
      () => listBillingInvoicesForAdmin(OVERVIEW_INVOICE_LIMIT),
      () => listAffiliates(),
      () => listStripeSubscriptionsForAdmin(),
    ] as const,
    ADMIN_DASHBOARD_DB_CONCURRENCY,
  );

  const billingUsers = clerkUsersToBillingMeta(clerkUsers);
  const activeAffiliateUserIds = buildActiveAffiliateUserIds(
    rawAffiliates,
    billingUsers,
  );
  const { paidSubscriberCount, subscriptions, invoices } = buildAdminBillingSnapshot({
    users: billingUsers,
    persistedBillingInvoices,
    stripeSubscriptions,
    activeAffiliateUserIds,
  });

  return {
    totalUsers: totalCount,
    totalDecks: dbStats.totalDecks,
    totalCards: dbStats.totalCards,
    adminGrantedProPlusCount: countAdminGrantedProPlus(clerkUsers),
    paidSubscriberCount,
    dbPaidSubscriberCount,
    subscriptions,
    invoices,
  };
}

export type AdminTabsData = {
  users: SerializedUser[];
  logs: SerializedLog[];
  planAssignmentLogs: SerializedPlanAssignmentLog[];
  subscriptions: SerializedAdminSubscription[];
  invoices: SerializedAdminInvoice[];
  supportTickets: SerializedTicket[];
  supportStats: SupportStats;
  plansConfig: PlanConfig[];
  affiliates: SerializedAffiliate[];
};

const EMPTY_SUPPORT_STATS: SupportStats = {
  byCategory: [],
  byStatus: [],
  byPriority: [],
  totals: { total: 0, openCount: 0, resolvedCount: 0, urgentCount: 0 },
};

export async function loadAdminTabsData(
  section: AdminDashboardSection,
): Promise<AdminTabsData> {
  const empty: AdminTabsData = {
    users: [],
    logs: [],
    planAssignmentLogs: [],
    subscriptions: [],
    invoices: [],
    supportTickets: [],
    supportStats: EMPTY_SUPPORT_STATS,
    plansConfig: [],
    affiliates: [],
  };

  switch (section) {
    case "support-center": {
      const [rawSupportTickets, supportStats] = await runDbTasksWithConcurrencyLimit(
        [() => getAllSupportTickets(), () => getSupportTicketStats()] as const,
        2,
      );
      return {
        ...empty,
        supportTickets: rawSupportTickets.map(serializeSupportTicketRow),
        supportStats,
      };
    }

    case "plans": {
      const [plansConfig, rawPlanAssignmentLogs, rawAffiliates] =
        await runDbTasksWithConcurrencyLimit(
          [
            () => readPlansConfig(),
            () => getAdminPlanAssignmentLogs(500),
            () => listAffiliates(),
          ] as const,
          3,
        );
      return {
        ...empty,
        plansConfig,
        affiliates: serializeAffiliatesForAdmin(rawAffiliates),
        planAssignmentLogs: rawPlanAssignmentLogs.map((log) => ({
          id: log.id,
          targetUserId: log.targetUserId,
          targetUserName: log.targetUserName,
          targetUserEmail: log.targetUserEmail ?? null,
          action: log.action as SerializedPlanAssignmentLog["action"],
          planName: log.planName ?? null,
          previousPlanName: log.previousPlanName ?? null,
          assignedByUserId: log.assignedByUserId,
          assignedByName: log.assignedByName,
          createdAt: log.createdAt.toISOString(),
        })),
      };
    }

    case "marketing-affiliates": {
      try {
        await evaluateAllActiveAffiliateQuotas();
      } catch (error) {
        console.error("[admin] affiliate quota evaluation:", error);
      }
      const rawAffiliates = await listAffiliates();
      return {
        ...empty,
        affiliates: serializeAffiliatesForAdmin(rawAffiliates),
      };
    }

    case "admin-roles": {
      const { data: clerkUsers } = await getAdminClerkUserList();
      const userIds = clerkUsers.map((u) => u.id);
      const [privilegeLogs, rawPlanAssignmentLogs, deckStatsByUser, ...teamMaps] =
        await runDbTasksWithConcurrencyLimit(
          [
            () => getAdminPrivilegeLogs(100),
            () => getAdminPlanAssignmentLogs(500),
            () => getDeckStatsByUser(),
            () => getTeamOwnerPlanLabelsByUserIds(userIds),
            () => getTeamOwnerPlanSlugsByUserIds(userIds),
            () =>
              getUserTeamPlanAssociationsByUserIds(
                userIds,
                clerkUsers.map((u) => {
                  const primary =
                    u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
                      ?.emailAddress ?? null;
                  return { userId: u.id, email: primary };
                }),
              ),
            () => getTeamWorkspaceCountsByOwnerUserIds(userIds),
            () => getTeamInviteeTotalsByOwnerUserIds(userIds),
          ] as const,
          ADMIN_DASHBOARD_DB_CONCURRENCY,
        );

      const [
        teamOwnerPlanByUserId,
        teamOwnerPlanSlugsByUserId,
        teamPlanByUserId,
        teamWorkspaceCountsByOwnerUserId,
        teamInviteeTotalsByOwnerUserId,
      ] = teamMaps;

      const users = serializeAdminUsers({
        clerkUsers,
        deckStatsByUser,
        teamPlanByUserId,
        teamOwnerPlanByUserId,
        teamOwnerPlanSlugsByUserId,
        teamWorkspaceCountsByOwnerUserId,
        teamInviteeTotalsByOwnerUserId,
        workspaceDetailsByOwnerUserId: new Map(),
        activeSessionData: new Map(),
        includeWorkspaceDetails: false,
      });

      return {
        ...empty,
        users,
        logs: privilegeLogs.map((log) => ({
          id: log.id,
          targetUserId: log.targetUserId,
          targetUserName: log.targetUserName,
          grantedByUserId: log.grantedByUserId,
          grantedByName: log.grantedByName,
          action: log.action as SerializedLog["action"],
          createdAt: log.createdAt.toISOString(),
        })),
        planAssignmentLogs: rawPlanAssignmentLogs.map((log) => ({
          id: log.id,
          targetUserId: log.targetUserId,
          targetUserName: log.targetUserName,
          targetUserEmail: log.targetUserEmail ?? null,
          action: log.action as SerializedPlanAssignmentLog["action"],
          planName: log.planName ?? null,
          previousPlanName: log.previousPlanName ?? null,
          assignedByUserId: log.assignedByUserId,
          assignedByName: log.assignedByName,
          createdAt: log.createdAt.toISOString(),
        })),
      };
    }

    case "subscription":
    case "invoices": {
      const { data: clerkUsers } = await getAdminClerkUserList();
      const invoiceLimit = section === "invoices" ? INVOICES_TAB_LIMIT : OVERVIEW_INVOICE_LIMIT;
      const [persistedBillingInvoices, rawAffiliates, stripeSubscriptions] =
        await runDbTasksWithConcurrencyLimit(
          [
            () => listBillingInvoicesForAdmin(invoiceLimit),
            () => listAffiliates(),
            () => listStripeSubscriptionsForAdmin(),
          ] as const,
          ADMIN_DASHBOARD_DB_CONCURRENCY,
        );
      const billingUsers = clerkUsersToBillingMeta(clerkUsers);
      const activeAffiliateUserIds = buildActiveAffiliateUserIds(
        rawAffiliates,
        billingUsers,
      );
      const { subscriptions, invoices } = buildAdminBillingSnapshot({
        users: billingUsers,
        persistedBillingInvoices,
        stripeSubscriptions,
        activeAffiliateUserIds,
      });

      if (section === "subscription") {
        const userIds = clerkUsers.map((u) => u.id);
        const [deckStatsByUser, teamOwnerPlanByUserId, teamOwnerPlanSlugsByUserId, teamPlanByUserId] =
          await runDbTasksWithConcurrencyLimit(
            [
              () => getDeckStatsByUser(),
              () => getTeamOwnerPlanLabelsByUserIds(userIds),
              () => getTeamOwnerPlanSlugsByUserIds(userIds),
              () =>
                getUserTeamPlanAssociationsByUserIds(
                  userIds,
                  clerkUsers.map((u) => {
                    const primary =
                      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
                        ?.emailAddress ?? null;
                    return { userId: u.id, email: primary };
                  }),
                ),
            ] as const,
            ADMIN_DASHBOARD_DB_CONCURRENCY,
          );

        const users = serializeAdminUsers({
          clerkUsers,
          deckStatsByUser,
          teamPlanByUserId,
          teamOwnerPlanByUserId,
          teamOwnerPlanSlugsByUserId,
          teamWorkspaceCountsByOwnerUserId: new Map(),
          teamInviteeTotalsByOwnerUserId: new Map(),
          workspaceDetailsByOwnerUserId: new Map(),
          activeSessionData: new Map(),
          includeWorkspaceDetails: false,
        });

        return { ...empty, users, subscriptions, invoices };
      }

      return { ...empty, subscriptions, invoices };
    }

    case "team-workspaces":
    case "all-users":
    default: {
      const { data: clerkUsers } = await getAdminClerkUserList();
      const userIds = clerkUsers.map((u) => u.id);
      const includeWorkspaceDetails = section === "team-workspaces";

      const factories: (() => Promise<unknown>)[] = [
        () => getDeckStatsByUser(),
        () =>
          getUserTeamPlanAssociationsByUserIds(
            userIds,
            clerkUsers.map((u) => {
              const primary =
                u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ??
                null;
              return { userId: u.id, email: primary };
            }),
          ),
        () => getTeamOwnerPlanLabelsByUserIds(userIds),
        () => getTeamOwnerPlanSlugsByUserIds(userIds),
        () => getTeamWorkspaceCountsByOwnerUserIds(userIds),
        () => getTeamInviteeTotalsByOwnerUserIds(userIds),
      ];

      if (includeWorkspaceDetails) {
        factories.push(() => getWorkspaceDetailsByOwnerUserIds(userIds));
      }
      if (section === "all-users") {
        factories.push(() => getActiveSessionData());
        factories.push(() => listAffiliates());
      }

      const results = await runDbTasksWithConcurrencyLimit(
        factories as readonly (() => Promise<unknown>)[],
        ADMIN_DASHBOARD_DB_CONCURRENCY,
      );

      let idx = 0;
      const deckStatsByUser = results[idx++] as Awaited<ReturnType<typeof getDeckStatsByUser>>;
      const teamPlanByUserId = results[idx++] as Awaited<
        ReturnType<typeof getUserTeamPlanAssociationsByUserIds>
      >;
      const teamOwnerPlanByUserId = results[idx++] as Awaited<
        ReturnType<typeof getTeamOwnerPlanLabelsByUserIds>
      >;
      const teamOwnerPlanSlugsByUserId = results[idx++] as Awaited<
        ReturnType<typeof getTeamOwnerPlanSlugsByUserIds>
      >;
      const teamWorkspaceCountsByOwnerUserId = results[idx++] as Awaited<
        ReturnType<typeof getTeamWorkspaceCountsByOwnerUserIds>
      >;
      const teamInviteeTotalsByOwnerUserId = results[idx++] as Awaited<
        ReturnType<typeof getTeamInviteeTotalsByOwnerUserIds>
      >;
      const workspaceDetailsByOwnerUserId = includeWorkspaceDetails
        ? (results[idx++] as Awaited<ReturnType<typeof getWorkspaceDetailsByOwnerUserIds>>)
        : new Map();
      const activeSessionData =
        section === "all-users"
          ? (results[idx++] as Awaited<ReturnType<typeof getActiveSessionData>>)
          : new Map<string, number>();
      const rawAffiliatesForUsers =
        section === "all-users"
          ? (results[idx++] as Awaited<ReturnType<typeof listAffiliates>>)
          : [];
      const activeAffiliateUserIds =
        section === "all-users"
          ? buildActiveAffiliateUserIds(
              rawAffiliatesForUsers,
              clerkUsers.map((u) => {
                const primary =
                  u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
                    ?.emailAddress ?? null;
                return {
                  id: u.id,
                  email: primary,
                } satisfies Pick<AdminBillingUserMeta, "id" | "email">;
              }),
            )
          : undefined;

      const users = serializeAdminUsers({
        clerkUsers,
        deckStatsByUser,
        teamPlanByUserId,
        teamOwnerPlanByUserId,
        teamOwnerPlanSlugsByUserId,
        teamWorkspaceCountsByOwnerUserId,
        teamInviteeTotalsByOwnerUserId,
        workspaceDetailsByOwnerUserId,
        activeSessionData,
        includeWorkspaceDetails,
        activeAffiliateUserIds,
      });

      return { ...empty, users };
    }
  }
}
