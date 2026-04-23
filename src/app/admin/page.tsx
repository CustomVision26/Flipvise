import dynamic from "next/dynamic";
import { createClerkClient } from "@clerk/backend";
import { getAccessContext } from "@/lib/access";
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
  getUserTeamPlanAssociationsByUserIds,
  getAdminPrivilegeLogs,
} from "@/db/queries/admin";
import { getAdminUserPlanColumnLabel } from "@/lib/admin-user-plan-label";
import {
  augmentAdminPlanLabelWithWinner,
  fetchUserBillingSubscriptionSafe,
  parsePlanSourceUpdatedAtMs,
  resolveAdminUserEffectivePlanSlug,
} from "@/lib/plan-metadata-billing-resolution";
import { isTeamPlanId } from "@/lib/team-plans";
import { getAllSupportTickets, getSupportTicketStats } from "@/db/queries/support";
import {
  serializeSupportTicketRow,
  type SerializedTicket,
} from "@/lib/support-admin-dto";
import type { SerializedLog, SerializedUser } from "@/lib/admin-dashboard-types";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CreditCard, Layers, ArrowLeft, BadgeCheck, ShieldCheck } from "lucide-react";

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
    activeSessionData,
    privilegeLogs,
    rawSupportTickets,
    supportStats,
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
    getActiveSessionData(),
    getAdminPrivilegeLogs(100),
    getAllSupportTickets(),
    getSupportTicketStats(),
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
    };
    const p = typeof meta?.plan === "string" ? meta.plan.trim() : "";
    const t = typeof meta?.teamPlanId === "string" ? meta.teamPlanId.trim() : "";
    const billingSlug = p || t;
    const isPaidPro =
      billingSlug === "pro" ||
      (Boolean(billingSlug) && isTeamPlanId(billingSlug)) ||
      meta?.stripe_subscription_status === "active";
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
      label: "Paid Subscribers",
      value: paidSubscriberCount,
      icon: BadgeCheck,
      description: "Active paying customers",
      accent: "text-green-500",
    },
    {
      label: "Admin-Approved Pro",
      value: adminApprovedCount + adminRoleProCount,
      icon: ShieldCheck,
      description: "Pro access granted by admin",
      accent: "text-blue-500",
    },
  ];

  const billingByUserId = new Map<
    string,
    Awaited<ReturnType<typeof fetchUserBillingSubscriptionSafe>>
  >();
  for (const u of clerkUsers) {
    const m = u.publicMetadata as {
      planSourceUpdatedAt?: unknown;
      stripe_subscription_status?: string;
    };
    const needsBillingSnapshot =
      parsePlanSourceUpdatedAtMs(m?.planSourceUpdatedAt) != null ||
      m?.stripe_subscription_status === "active";
    if (!needsBillingSnapshot) continue;
    billingByUserId.set(
      u.id,
      await fetchUserBillingSubscriptionSafe(clerkClient, u.id),
    );
  }

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
    };

    const isSuperadmin =
      meta?.role === "superadmin" || isPlatformSuperadminAllowListed(user.id);
    const isCoAdmin = meta?.role === "admin";
    const isAdmin = isCoAdmin || isSuperadmin;
    const isBanned = user.banned === true;

    const metaMs = parsePlanSourceUpdatedAtMs(meta?.planSourceUpdatedAt);
    const billingSub =
      metaMs != null || meta?.stripe_subscription_status === "active"
        ? (billingByUserId.get(user.id) ?? null)
        : null;
    const planResolutionAdmin = resolveAdminUserEffectivePlanSlug({
      publicMetadata: meta,
      subscription: billingSub,
    });
    const planOrTeamSlug = planResolutionAdmin.effectiveSlug;

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
    // Banned users cannot have active sessions.
    const activeSessionCount = !isBanned ? (activeSessionData.get(user.id) ?? 0) : 0;
    const isOnline = activeSessionCount > 0;

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
      planDisplayName,
      associatePlan,
      isOnline,
      activeSessionCount,
      lastUpdated: userStats?.lastUpdated?.toISOString() ?? null,
      createdAt: new Date(user.createdAt).toISOString(),
      lastSignInAt: user.lastSignInAt
        ? new Date(user.lastSignInAt).toISOString()
        : null,
    };
  });

  // Serialize support tickets (dates → ISO strings).
  const serializedTickets: SerializedTicket[] =
    rawSupportTickets.map(serializeSupportTicketRow);

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
        {statsCards.map(({ label, value, icon: Icon, description, accent }) => (
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
        supportTickets={serializedTickets}
        supportStats={supportStats}
      />
    </div>
  );
}
