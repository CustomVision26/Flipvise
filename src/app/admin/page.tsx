import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { getAdminOverviewStats, getDeckStatsByUser, getAdminPrivilegeLogs } from "@/db/queries/admin";
import { AdminTabs, type SerializedUser, type SerializedLog } from "@/components/admin-tabs";
import { Users, CreditCard, Layers, ArrowLeft, BadgeCheck, ShieldCheck } from "lucide-react";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function getActiveSessionUserIds(): Promise<Set<string>> {
  try {
    const res = await fetch(
      "https://api.clerk.com/v1/sessions?status=active&limit=500",
      {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return new Set();
    const body: unknown = await res.json();
    const sessions: { user_id: string }[] = Array.isArray(body)
      ? (body as { user_id: string }[])
      : ((body as { data?: { user_id: string }[] }).data ?? []);
    return new Set(sessions.map((s) => s.user_id));
  } catch {
    return new Set();
  }
}

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const [
    { data: clerkUsers, totalCount },
    dbStats,
    deckStatsByUser,
    activeUserIds,
    privilegeLogs,
  ] = await Promise.all([
    clerkClient.users.getUserList({ limit: 500, orderBy: "-created_at" }),
    getAdminOverviewStats(),
    getDeckStatsByUser(),
    getActiveSessionUserIds(),
    getAdminPrivilegeLogs(100),
  ]);

  // Verify admin role from the live Clerk API — sessionClaims can lag after
  // publicMetadata is updated in the Dashboard until the JWT rotates.
  const currentUser = clerkUsers.find((u) => u.id === userId);
  const liveRole = (currentUser?.publicMetadata as { role?: string })?.role;
  if (liveRole !== "admin") redirect("/dashboard");

  const statsByUserId = new Map(deckStatsByUser.map((s) => [s.userId, s]));

  // Break down Pro access into three distinct categories.
  let paidSubscriberCount = 0;
  let adminApprovedCount = 0;
  let adminRoleProCount = 0;

  for (const u of clerkUsers) {
    const meta = u.publicMetadata as {
      role?: string;
      plan?: string;
      stripe_subscription_status?: string;
      adminGranted?: boolean;
    };
    const isPaidPro =
      meta?.plan === "pro" || meta?.stripe_subscription_status === "active";
    const isAdminGranted = meta?.adminGranted === true;
    const isAdminRole = meta?.role === "admin";

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
      stripe_subscription_status?: string;
      adminGranted?: boolean;
    };

    const isAdmin = meta?.role === "admin";
    const isBanned = user.banned === true;
    const isPaidPro =
      meta?.plan === "pro" || meta?.stripe_subscription_status === "active";
    const adminGranted = meta?.adminGranted === true;
    // Admins automatically have all Pro features; no manual grant needed.
    const isPro = isPaidPro || adminGranted || isAdmin;
    // Banned users cannot have active sessions.
    const isOnline = !isBanned && activeUserIds.has(user.id);

    const userStats = statsByUserId.get(user.id);

    return {
      id: user.id,
      fullName,
      email: primaryEmail,
      isAdmin,
      isBanned,
      isPaidPro,
      adminGranted,
      isPro,
      isOnline,
      deckCount: userStats?.deckCount ?? 0,
      cardCount: userStats?.cardCount ?? 0,
      lastUpdated: userStats?.lastUpdated?.toISOString() ?? null,
      createdAt: new Date(user.createdAt).toISOString(),
      lastSignInAt: user.lastSignInAt
        ? new Date(user.lastSignInAt).toISOString()
        : null,
    };
  });

  // Serialize DB log rows (dates → ISO strings).
  const serializedLogs: SerializedLog[] = privilegeLogs.map((log) => ({
    id: log.id,
    targetUserId: log.targetUserId,
    targetUserName: log.targetUserName,
    grantedByUserId: log.grantedByUserId,
    grantedByName: log.grantedByName,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-1 flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage all users across Flipvise
          </p>
        </div>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "outline", size: "sm" }) + " shrink-0"}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          My Decks
        </Link>
      </div>

      {/* Overview stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statsCards.map(({ label, value, icon: Icon, description, accent }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
                {label}
              </CardTitle>
              <Icon className={`h-4 w-4 shrink-0 ${accent || "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${accent}`}>
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
        users={serializedUsers}
        logs={serializedLogs}
      />
    </div>
  );
}
