import dynamic from "next/dynamic";
import { createClerkClient } from "@clerk/backend";
import { promises as fs } from "fs";
import path from "path";
import { getAccessContext } from "@/lib/access";
import type { PlanConfig } from "@/components/pricing-content";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import {
  isPlatformSuperadminAllowListed,
  reconcilePlatformSuperadminClerkMetadata,
} from "@/lib/platform-superadmin";
import { personalDashboardHref } from "@/lib/personal-dashboard-url";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  getAdminOverviewStats,
  getDeckStatsByUser,
  getTeamOwnerPlanLabelsByUserIds,
  getTeamOwnerPlanSlugsByUserIds,
  getUserTeamPlanAssociationsByUserIds,
  getAdminPrivilegeLogs,
  getTeamWorkspaceCountsByOwnerUserIds,
  getTeamInviteeTotalsByOwnerUserIds,
  getWorkspaceDetailsByOwnerUserIds,
} from "@/db/queries/admin";
import { getAdminUserPlanColumnLabel } from "@/lib/admin-user-plan-label";
import {
  augmentAdminPlanLabelWithWinner,
  billingActivePlanSlug,
  billingReferenceTimestampMs,
  fetchUserBillingSubscriptionSafe,
  metadataPlanSlugFromPublicMeta,
  parsePlanSourceUpdatedAtMs,
  resolveAdminUserEffectivePlanSlug,
} from "@/lib/plan-metadata-billing-resolution";
import {
  buildAdminInvoiceRows,
  buildAdminSubscriptionRows,
} from "@/lib/billing-dashboard";
import { isTeamPlanId, limitsForPlan, TEAM_PLAN_LABELS } from "@/lib/team-plans";
import { getAllSupportTickets, getSupportTicketStats } from "@/db/queries/support";
import { countPaidSubscribersFromDB, listBillingInvoicesForAdmin } from "@/db/queries/billing";
import { listAffiliates } from "@/db/queries/affiliates";
import type { SerializedAffiliate } from "@/lib/admin-dashboard-types";
import {
  serializeSupportTicketRow,
  type SerializedTicket,
} from "@/lib/support-admin-dto";
import type {
  SerializedAdminInvoice,
  SerializedAdminSubscription,
  SerializedLog,
  SerializedUser,
} from "@/lib/admin-dashboard-types";
import { buildTeamWorkspaceDashboardPath } from "@/lib/team-workspace-url";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CreditCard, Layers, ArrowLeft, ShieldCheck } from "lucide-react";
import { PaidSubscribersCard } from "@/components/paid-subscribers-card";

const AdminTabs = dynamic(
  () => import("@/components/admin-tabs").then((m) => m.AdminTabs),
  {
    ssr: true,
    loading: () => (
      <div
        className="rounded-tl-none border border-t-0 p-4 space-y-3"
        aria-busy
        aria-label="Loading admin panel"
      >
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    ),
  },
);

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function adminPlanLabelFromSlug(slug: string | undefined): string {
  if (!slug) return "Free";
  if (slug === "pro") return "Pro";
  if (isTeamPlanId(slug)) return TEAM_PLAN_LABELS[slug];
  return slug;
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

async function getActiveSessionData(): Promise<Map<string, number>> {
  try {
    const res = await fetch(
      "https://api.clerk.com/v1/sessions?status=active&limit=500",
      {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return new Map();
    const body: unknown = await res.json();
    const sessions: { user_id: string }[] = Array.isArray(body)
      ? (body as { user_id: string }[])
      : ((body as { data?: { user_id: string }[] }).data ?? []);
    const sessionCounts = new Map<string, number>();
    for (const s of sessions) {
      sessionCounts.set(s.user_id, (sessionCounts.get(s.user_id) ?? 0) + 1);
    }
    return sessionCounts;
  } catch {
    return new Map();
  }
}

export default async function AdminPage() {
  const { userId, isPro, activeTeamPlan } = await getAccessContext();
  if (!userId) redirect("/");

  const personalDashboardLink = personalDashboardHref(
    userId,
    activeTeamPlan,
    isPro,
  );

  await reconcilePlatformSuperadminClerkMetadata(clerkClient, userId);

  const { data: clerkUsers, totalCount } = await clerkClient.users.getUserList({
    limit: 500,
    orderBy: "-created_at",
  });

  const userIds = clerkUsers.map((u) => u.id);
  const [
    dbStats,
    deckStatsByUser,
    teamPlanByUserId,
    teamOwnerPlanByUserId,
    teamOwnerPlanSlugsByUserId,
    teamWorkspaceCountsByOwnerUserId,
    teamInviteeTotalsByOwnerUserId,
    workspaceDetailsByOwnerUserId,
    activeSessionData,
    privilegeLogs,
    rawSupportTickets,
    supportStats,
    persistedBillingInvoices,
    dbPaidSubscriberCount,
    rawAffiliates,
  ] = await Promise.all([
    getAdminOverviewStats(),
    getDeckStatsByUser(),
    getUserTeamPlanAssociationsByUserIds(
      userIds,
      clerkUsers.map((u) => {
        const primary =
          u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
            ?.emailAddress ?? null;
        return { userId: u.id, email: primary };
      }),
    ),
    getTeamOwnerPlanLabelsByUserIds(userIds),
    getTeamOwnerPlanSlugsByUserIds(userIds),
    getTeamWorkspaceCountsByOwnerUserIds(userIds),
    getTeamInviteeTotalsByOwnerUserIds(userIds),
    getWorkspaceDetailsByOwnerUserIds(userIds),
    getActiveSessionData(),
    getAdminPrivilegeLogs(100),
    getAllSupportTickets(),
    getSupportTicketStats(),
    listBillingInvoicesForAdmin(2000),
    countPaidSubscribersFromDB(),
    listAffiliates(),
  ]);

  // Verify platform admin from the live Clerk API — sessionClaims can lag after
  // publicMetadata is updated in the Dashboard until the JWT rotates.
  const currentUser = clerkUsers.find((u) => u.id === userId);
  const liveRole = (currentUser?.publicMetadata as { role?: string })?.role;
  const canAccessAdmin =
    isClerkPlatformAdminRole(liveRole) || isPlatformSuperadminAllowListed(userId);
  if (!canAccessAdmin) redirect(personalDashboardLink);

  const callerIsSuperadmin =
    isPlatformSuperadminAllowListed(userId) || liveRole === "superadmin";

  // Pull Clerk Billing subscription snapshots for every listed user so admin-level
  // counters (Paid Subscribers) reflect Clerk billing truth, not metadata heuristics.
  const billingByUserId = new Map<
    string,
    Awaited<ReturnType<typeof fetchUserBillingSubscriptionSafe>>
  >(
    await Promise.all(
      clerkUsers.map(async (u) => [
        u.id,
        await fetchUserBillingSubscriptionSafe(clerkClient, u.id),
      ]),
    ),
  );

  const statsByUserId = new Map(deckStatsByUser.map((s) => [s.userId, s]));

  // Break down Pro access into three distinct categories.
  let paidSubscriberCount = 0;
  let adminApprovedCount = 0;
  let adminRoleProCount = 0;

  for (const u of clerkUsers) {
    const meta = u.publicMetadata as {
      role?: string;
      plan?: string;
      teamPlanId?: string;
      stripe_subscription_status?: string;
      adminGranted?: boolean;
      /** Written by Stripe webhook → setStripeBillingState */
      billingPlan?: string;
      billingStatus?: string;
    };
    const billingSub = billingByUserId.get(u.id) ?? null;
    // Clerk Billing slug (null when project uses Stripe instead of Clerk Billing)
    const clerkBillingSlug = billingActivePlanSlug(billingSub ?? undefined);
    // Stripe webhook writes billingPlan + billingStatus to publicMetadata
    const stripeActive =
      meta?.billingStatus === "active" || meta?.billingStatus === "trialing";
    const stripePlanSlug = stripeActive ? (meta?.billingPlan ?? null) : null;
    // Use whichever source has an active paid plan
    const effectiveSlug = clerkBillingSlug ?? stripePlanSlug;
    const isPaidPro = effectiveSlug === "pro" || isTeamPlanId(effectiveSlug ?? "");
    const isAdminGranted = meta?.adminGranted === true;
    const isAdminRole =
      meta?.role === "admin" || meta?.role === "superadmin";

    if (isPaidPro) paidSubscriberCount++;
    else if (isAdminGranted) adminApprovedCount++;
    else if (isAdminRole) adminRoleProCount++;
  }

  const statsCards = [
    {
      label: "Total Users",
      value: totalCount,
      icon: Users,
      description: "Registered accounts",
      accent: "",
    },
    {
      label: "Total Decks",
      value: dbStats.totalDecks,
      icon: Layers,
      description: "Across all users",
      accent: "",
    },
    {
      label: "Total Cards",
      value: dbStats.totalCards,
      icon: CreditCard,
      description: "Flashcards created",
      accent: "",
    },
    {
      label: "Admin-Approved Pro",
      value: adminApprovedCount + adminRoleProCount,
      icon: ShieldCheck,
      description: "Pro access granted by admin",
      accent: "text-blue-500",
    },
  ];

  // Serialize Clerk user objects into plain data safe to pass to a Client Component.
  const serializedUsers: SerializedUser[] = clerkUsers.map((user) => {
    const primaryEmail =
      user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
        ?.emailAddress ?? null;

    const fullName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.username ||
      "—";

    const meta = user.publicMetadata as {
      role?: string;
      plan?: string;
      /** Set by `syncTeamSubscriberRoleMetadata` for team-tier Clerk billing; may be absent in `plan`. */
      teamPlanId?: string;
      stripe_subscription_status?: string;
      adminGranted?: boolean;
      planSourceUpdatedAt?: string;
      billingPlan?: string;
      billingStatus?: string;
      billingPlanUpdatedAt?: string;
      adminPlan?: string;
      adminPlanUpdatedAt?: string;
    };

    const isSuperadmin =
      meta?.role === "superadmin" || isPlatformSuperadminAllowListed(user.id);
    const isCoAdmin = meta?.role === "admin";
    const isAdmin = isCoAdmin || isSuperadmin;
    const isBanned = user.banned === true;

    const billingSub = billingByUserId.get(user.id) ?? null;
    const planResolutionAdmin = resolveAdminUserEffectivePlanSlug({
      publicMetadata: meta,
      subscription: billingSub,
    });
    const planOrTeamSlug = planResolutionAdmin.effectiveSlug;
    const adminAssignedAtMs = parsePlanSourceUpdatedAtMs(meta?.planSourceUpdatedAt);
    const billingReferenceMs = billingReferenceTimestampMs(billingSub);
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
    const clerkCurrentSlug = billingActivePlanSlug(billingSub ?? undefined) ?? metadataAssignedSlug;

    const isPaidPro =
      planOrTeamSlug === "pro" ||
      (planOrTeamSlug != null &&
        planOrTeamSlug.length > 0 &&
        isTeamPlanId(planOrTeamSlug)) ||
      meta?.stripe_subscription_status === "active";
    const adminGranted = meta?.adminGranted === true;
    // Admins automatically have all Pro features; no manual grant needed.
    const isPro = isPaidPro || adminGranted || isAdmin;
    const associatePlan = teamPlanByUserId.get(user.id)?.label ?? null;
    const fromClerk = getAdminUserPlanColumnLabel({
      isSuperadmin,
      isCoAdmin,
      adminGranted,
      planMeta: planOrTeamSlug,
      stripeSubscriptionActive: meta?.stripe_subscription_status === "active",
    });
    const withAssociateFallback =
      fromClerk !== "Free" ? fromClerk : (teamOwnerPlanByUserId.get(user.id) ?? "Free");
    const planDisplayName = augmentAdminPlanLabelWithWinner(withAssociateFallback, {
      comparedMetadataToBilling: planResolutionAdmin.comparedMetadataToBilling,
      winner: planResolutionAdmin.winner,
      legacyMetadataOverride: planResolutionAdmin.legacyMetadataOverride,
    });
    const roleAutoProLabel = isAdmin ? "Pro" : null;
    const nonFreePlanFallback =
      roleAutoProLabel ?? (withAssociateFallback !== "Free" ? withAssociateFallback : null);
    const clerkPlanLabelRaw = adminPlanLabelFromSlug(clerkCurrentSlug);
    const clerkPlanLabel = clerkPlanLabelRaw;
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
    // Banned users cannot have active sessions.
    const activeSessionCount = !isBanned ? (activeSessionData.get(user.id) ?? 0) : 0;
    const isOnline = activeSessionCount > 0;
    const ownedTeamPlanSlugs = (teamOwnerPlanSlugsByUserId.get(user.id) ?? []).filter(
      isTeamPlanId,
    );
    const fallbackOwnedTeamSlug =
      ownedTeamPlanSlugs.length > 0 ? ownedTeamPlanSlugs[0] : null;
    // Derive a team slug directly from the live billing subscription so that cases where
    // resolveAdminUserEffectivePlanSlug returns a personal-Pro slug ("pro") while the
    // billing subscription carries a team-tier plan are still captured correctly.
    const liveBillingTeamSlug = (() => {
      const s = billingActivePlanSlug(billingSub ?? undefined);
      return s != null && isTeamPlanId(s) ? s : null;
    })();
    const teamTierPlanSlug = isTeamPlanId(planOrTeamSlug ?? "")
      ? planOrTeamSlug
      : (liveBillingTeamSlug ?? fallbackOwnedTeamSlug);
    const workspaceCreatedCount = teamWorkspaceCountsByOwnerUserId.get(user.id) ?? 0;
    const workspaceTotalCount =
      teamTierPlanSlug == null ? null : limitsForPlan(teamTierPlanSlug).maxTeams;
    const workspaceRemainingCount =
      teamTierPlanSlug == null
        ? null
        : Math.max((workspaceTotalCount ?? 0) - workspaceCreatedCount, 0);
    const totalInviteesCount = teamInviteeTotalsByOwnerUserId.get(user.id) ?? 0;
    const workspaces = (workspaceDetailsByOwnerUserId.get(user.id) ?? []).map((workspace) => ({
      id: workspace.teamId,
      name: workspace.teamName,
      href: buildTeamWorkspaceDashboardPath({
        teamId: workspace.teamId,
        ownerUserId: workspace.ownerUserId,
        teamMemberUrlParam: 0,
        plan: workspace.planSlug,
      }),
      ownerName: fullName,
      inviteeTotal: workspace.inviteeTotal,
      inviteeAdminTotal: workspace.inviteeAdminTotal,
      inviteeMemberTotal: workspace.inviteeMemberTotal,
      deckTotal: workspace.deckTotal,
      cardTotal: workspace.cardTotal,
      invitees: workspace.invitees.map((invitee) => {
        const inviteeUser =
          invitee.userId != null ? clerkUsers.find((u) => u.id === invitee.userId) : null;
        const inviteeNameFromClerk = inviteeUser
          ? [inviteeUser.firstName, inviteeUser.lastName].filter(Boolean).join(" ") ||
            inviteeUser.username ||
            null
          : null;
        const inviteePrimaryEmail = inviteeUser
          ? (inviteeUser.emailAddresses.find((e) => e.id === inviteeUser.primaryEmailAddressId)
              ?.emailAddress ?? null)
          : null;
        const resolvedEmail = invitee.email ?? inviteePrimaryEmail;
        return {
          userId: invitee.userId,
          name: inviteeNameFromClerk,
          email: resolvedEmail,
          role: invitee.role === "team_admin" ? ("admin" as const) : ("member" as const),
          membershipStatus: invitee.membershipStatus,
          assignedDeckNames: invitee.assignedDeckNames,
        };
      }),
    }));

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
      billingPlan: meta.billingPlan ?? null,
      billingStatus: meta.billingStatus ?? null,
      billingPlanUpdatedAt: meta.billingPlanUpdatedAt ?? null,
      adminPlan: meta.adminPlan ?? null,
      adminPlanUpdatedAt: meta.adminPlanUpdatedAt ?? null,
    };
  });

  // Read pricing plans config from JSON file.
  let plansConfig: PlanConfig[] = [];
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "src", "data", "plans-config.json"),
      "utf-8",
    );
    plansConfig = JSON.parse(raw) as PlanConfig[];
  } catch {
    // Fall back to empty array if file is missing; editor will show nothing.
  }

  // Serialize support tickets (dates → ISO strings).
  const serializedTickets: SerializedTicket[] =
    rawSupportTickets.map(serializeSupportTicketRow);

  const serializedSubscriptions: SerializedAdminSubscription[] =
    buildAdminSubscriptionRows(serializedUsers, billingByUserId);
  const liveBillingInvoices: SerializedAdminInvoice[] = buildAdminInvoiceRows(
    serializedUsers,
    billingByUserId,
  );
  const userById = new Map(serializedUsers.map((user) => [user.id, user]));
  const persistedSerializedInvoices: SerializedAdminInvoice[] = persistedBillingInvoices.map((row) => {
    const user = userById.get(row.userId);
    return {
      id: row.externalId,
      userId: row.userId,
      userName: user?.fullName ?? row.userId,
      email: row.userEmail ?? user?.email ?? null,
      invoiceNumber: row.invoiceNumber ?? row.externalId,
      status: row.status,
      amountDue: row.amountCents,
      currency: row.currency,
      createdAt: row.paidAt?.toISOString() ?? row.createdAt.toISOString(),
      periodStart: row.periodStart?.toISOString() ?? null,
      periodEnd: row.periodEnd?.toISOString() ?? null,
      hostedInvoiceUrl: row.hostedInvoiceUrl,
      invoicePdfUrl: row.invoicePdfUrl,
    };
  });
  const byId = new Map<string, SerializedAdminInvoice>();
  for (const invoice of persistedSerializedInvoices) {
    byId.set(invoice.id, invoice);
  }
  for (const invoice of liveBillingInvoices) {
    if (!byId.has(invoice.id)) byId.set(invoice.id, invoice);
  }
  const serializedInvoices: SerializedAdminInvoice[] = Array.from(byId.values()).sort((a, b) => {
    const left = a.createdAt ? Date.parse(a.createdAt) : 0;
    const right = b.createdAt ? Date.parse(b.createdAt) : 0;
    return right - left;
  });

  // Serialize affiliate rows (dates → ISO strings).
  const serializedAffiliates: SerializedAffiliate[] = rawAffiliates.map((a) => ({
    id: a.id,
    invitedEmail: a.invitedEmail,
    invitedUserId: a.invitedUserId ?? null,
    affiliateName: a.affiliateName,
    planAssigned: a.planAssigned,
    startedAt: a.startedAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    addedByUserId: a.addedByUserId,
    addedByName: a.addedByName,
    status: a.status as "pending" | "active" | "revoked",
    // Token is intentionally omitted from admin view for security —
    // it is only needed when serving the invite to the invitee directly.
    token: null,
    inviteAcceptedAt: a.inviteAcceptedAt ? a.inviteAcceptedAt.toISOString() : null,
    revokedAt: a.revokedAt ? a.revokedAt.toISOString() : null,
    revokedByName: a.revokedByName ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  // Serialize DB log rows (dates → ISO strings).
  const serializedLogs: SerializedLog[] = privilegeLogs.map((log) => ({
    id: log.id,
    targetUserId: log.targetUserId,
    targetUserName: log.targetUserName,
    grantedByUserId: log.grantedByUserId,
    grantedByName: log.grantedByName,
    action: log.action as SerializedLog["action"],
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-8 p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Monitor and manage all users across Flipvise
          </p>
        </div>
        <Link
          href={personalDashboardLink}
          className={buttonVariants({ variant: "outline", size: "sm" }) + " shrink-0 text-xs sm:text-sm h-8 sm:h-9"}
        >
          <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" aria-hidden />
          Personal Dashboard
        </Link>
      </div>

      {/* Overview stat cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* Static metric cards (first 3) */}
        {statsCards.slice(0, 3).map(({ label, value, icon: Icon, description, accent }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                {label}
              </CardTitle>
              <Icon className={`h-3 w-3 sm:h-4 sm:w-4 shrink-0 ${accent || "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl sm:text-3xl font-bold ${accent}`}>
                {value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}

        {/* Paid Subscribers — single-click → full page, double-click → preview dialog */}
        <PaidSubscribersCard
          paidSubscriberCount={paidSubscriberCount}
          dbPaidSubscriberCount={dbPaidSubscriberCount}
          subscriptions={serializedSubscriptions}
          invoices={serializedInvoices}
        />

        {/* Remaining static cards (Admin-Approved Pro) */}
        {statsCards.slice(3).map(({ label, value, icon: Icon, description, accent }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                {label}
              </CardTitle>
              <Icon className={`h-3 w-3 sm:h-4 sm:w-4 shrink-0 ${accent || "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl sm:text-3xl font-bold ${accent}`}>
                {value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabbed panel — All Users / Admin Roles / Audit Log */}
      <AdminTabs
        currentUserId={userId}
        callerIsSuperadmin={callerIsSuperadmin}
        users={serializedUsers}
        logs={serializedLogs}
        subscriptions={serializedSubscriptions}
        invoices={serializedInvoices}
        supportTickets={serializedTickets}
        supportStats={supportStats}
        plansConfig={plansConfig}
        affiliates={serializedAffiliates}
      />
    </div>
  );
}
