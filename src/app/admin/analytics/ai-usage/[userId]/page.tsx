import { createClerkClient } from "@clerk/backend";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminAiUsageUserDetail,
  type AdminAiUsageUserDetailProps,
} from "@/components/admin-ai-usage-user-detail";
import { buttonVariants } from "@/components/ui/button-variants";
import { getAiUsageUserDetails } from "@/db/queries/ai-usage";
import {
  getTeamMembershipsForUser,
  getTeamsByIds,
  getTeamsByOwner,
} from "@/db/queries/teams";
import {
  AI_USAGE_PLATFORM_TIMEZONE,
  resolveDateRangePreset,
} from "@/lib/ai-usage/period";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { toClientJson } from "@/lib/to-client-json";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AdminAiUsageUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: SearchParams;
}) {
  const { userId } = await params;
  if (!userId?.trim()) notFound();

  const sp = await searchParams;
  const preset = first(sp.preset) ?? "current_month";
  const from = first(sp.from) ?? null;
  const to = first(sp.to) ?? null;
  const range = resolveDateRangePreset(preset, from, to);

  let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>> | null =
    null;
  try {
    clerkUser = await clerkClient.users.getUser(userId);
  } catch {
    notFound();
  }

  const [details, memberships, ownedTeams] = await Promise.all([
    getAiUsageUserDetails({
      userId,
      start: range.start,
      end: range.end,
    }),
    getTeamMembershipsForUser(userId).catch(() => []),
    getTeamsByOwner(userId).catch(() => []),
  ]);

  const memberTeamIds = memberships.map((m) => m.teamId);
  const memberTeams =
    memberTeamIds.length > 0
      ? await getTeamsByIds(memberTeamIds).catch(() => [])
      : [];
  const teamMap = new Map<number, { id: number; name: string }>();
  for (const t of [...ownedTeams, ...memberTeams]) {
    teamMap.set(t.id, { id: t.id, name: t.name });
  }
  const userTeams = [...teamMap.values()];

  const email =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    userId;

  const teamLabel =
    userTeams.length > 0
      ? userTeams.map((t) => t.name).join(", ")
      : details.context.teamId != null
        ? `Team #${details.context.teamId}`
        : "—";

  const props: AdminAiUsageUserDetailProps = {
    timezone: AI_USAGE_PLATFORM_TIMEZONE,
    user: {
      userId,
      name,
      email,
    },
    planLabel: displayNameForBillingPlanSlug(
      details.context.subscriptionPlan,
    ),
    teamLabel,
    range: {
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      preset: range.preset,
    },
    context: {
      allowance: details.context.allowance,
      source: details.context.source,
      aiAccessEnabled: details.context.aiAccessEnabled,
      blockAtLimit: details.context.blockAtLimit,
      allowOverage: details.context.allowOverage,
      subscriptionPlan: details.context.subscriptionPlan,
      teamId: details.context.teamId,
      periodStart: details.context.periodStart,
      periodEnd: details.context.periodEnd,
      flagged: details.context.flagged,
      flagReason: details.context.flagReason,
      snapshot: details.context.snapshot,
      userLimit: details.context.userLimit
        ? {
            monthlyAllowance: details.context.userLimit.monthlyAllowance,
            unlimited: details.context.userLimit.unlimited,
            aiAccessEnabled: details.context.userLimit.aiAccessEnabled,
            warningThreshold80: details.context.userLimit.warningThreshold80,
            warningThreshold90: details.context.userLimit.warningThreshold90,
            warningThreshold100: details.context.userLimit.warningThreshold100,
            flagged: details.context.userLimit.flagged,
            flagReason: details.context.userLimit.flagReason,
            notes: details.context.userLimit.notes,
          }
        : null,
    },
    daily: details.daily,
    byFeature: details.byFeature.map((r) => ({
      feature: r.feature,
      generations: Number(r.generations),
      failed: Number(r.failed),
      totalTokens: Number(r.totalTokens),
      estimatedCostMicros: Number(r.estimatedCostMicros),
    })),
    byModel: details.byModel.map((r) => ({
      model: r.model,
      generations: Number(r.generations),
      totalTokens: Number(r.totalTokens),
      estimatedCostMicros: Number(r.estimatedCostMicros),
    })),
    outcomes: details.outcomes,
    recent: details.recent,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 border-b border-border/60 pb-5">
        <Link
          href="/admin/analytics/ai-usage"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-2 -ml-2 h-8 gap-1.5 text-muted-foreground",
          )}
        >
          <ArrowLeft className="size-3.5" />
          Back to AI Usage
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          AI &amp; analytics
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          AI usage — {name}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Period limits, token and cost history, request outcomes, and admin
          overrides for this account.
        </p>
        <p className="text-xs text-muted-foreground">
          Timezone:{" "}
          <span className="font-medium text-foreground">
            {AI_USAGE_PLATFORM_TIMEZONE}
          </span>
        </p>
      </header>

      <AdminAiUsageUserDetail {...toClientJson(props)} />
    </div>
  );
}
