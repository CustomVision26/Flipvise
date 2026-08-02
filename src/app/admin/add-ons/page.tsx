import {
  AdminAddonCatalogDashboard,
  type AdminAddonCatalogItem,
} from "@/components/admin-addon-catalog-dashboard";
import {
  adminOverviewStatCardClass,
  adminSupportChartCardClass,
  adminSupportSectionLabelClass,
} from "@/components/admin-panel-styles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAddonCatalogSettings,
  listActiveEntitlementsForAddon,
  listAllActiveAddonEntitlements,
  listAddonCatalog,
} from "@/db/queries/addons";
import {
  countEssayUsageByType,
  listActiveEssayUserIds,
} from "@/db/queries/essays";
import { getAdminClerkUserList } from "@/lib/admin/admin-clerk-cache";
import {
  resolveAdminUserPlanBillingContext,
  type AdminPlanAccessMeta,
} from "@/lib/admin-user-plan-label";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";
import { toClientJson } from "@/lib/to-client-json";
import { cn } from "@/lib/utils";
import { Activity, Coins, Sparkles, Users } from "lucide-react";
import type { AdminAddonEntitlementRow } from "@/components/admin-addon-catalog-dashboard";

function basePlanLabelFromSlug(slug: string | null): string {
  if (!slug || slug === "free") return "Free";
  try {
    return displayNameForBillingPlanSlug(slug);
  } catch {
    return slug;
  }
}

export const dynamic = "force-dynamic";

function clerkUserDisplayName(user: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (user.username?.trim()) return user.username.trim();
  return user.id;
}

function formatEventType(eventType: string): string {
  return eventType
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default async function AdminAddOnsPage() {
  const [
    settings,
    catalog,
    essayUsage,
    essayUsers,
    essayEntitlements,
    allEntitlements,
    clerkUsers,
  ] = await Promise.all([
    getAddonCatalogSettings(),
    listAddonCatalog(),
    countEssayUsageByType(),
    listActiveEssayUserIds(),
    listActiveEntitlementsForAddon(AI_ESSAY_ADDON_KEY),
    listAllActiveAddonEntitlements(),
    getAdminClerkUserList(),
  ]);

  const items: AdminAddonCatalogItem[] = catalog.map((row) => ({
    ...row,
    stripePriceConfigured: Boolean(
      resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey),
    ),
  }));

  const catalogNameByKey = new Map(items.map((item) => [item.key, item.name]));

  const assignableUsers = clerkUsers.data
    .map((user) => {
      const email =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;
      const planCtx = resolveAdminUserPlanBillingContext(
        (user.publicMetadata ?? {}) as AdminPlanAccessMeta,
      );
      const planSlug = planCtx.effectivePlanSlug;
      return {
        userId: user.id,
        name: clerkUserDisplayName(user),
        email,
        planSlug,
        planLabel: basePlanLabelFromSlug(planSlug),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const userById = new Map(assignableUsers.map((user) => [user.userId, user]));

  const entitlementRows: AdminAddonEntitlementRow[] = allEntitlements.map(
    (row) => {
      const user = userById.get(row.userId);
      return {
        id: row.id,
        userId: row.userId,
        userName: user?.name ?? row.userId,
        userEmail: user?.email ?? null,
        planSlug: user?.planSlug ?? null,
        planLabel: user?.planLabel ?? "Unknown",
        addonKey: row.addonKey,
        addonName: catalogNameByKey.get(row.addonKey) ?? row.addonKey,
        source: row.source,
        updatedAt: row.updatedAt.toISOString(),
      };
    },
  );

  const tokensUsed = essayUsage.reduce((sum, row) => sum + row.tokensUsed, 0);
  const activeCount = items.filter((item) => item.active).length;
  const listedCount = items.filter((item) => item.publishedOnPricing).length;

  const usageMetrics = [
    {
      label: "Active Essay entitlements",
      value: essayEntitlements.length,
      description: "Users with AI Essay access right now",
      icon: Users,
    },
    {
      label: "Users with activity",
      value: essayUsers.length,
      description: "Accounts that have generated essay events",
      icon: Activity,
    },
    {
      label: "AI tokens tracked",
      value: tokensUsed,
      description: "Cumulative tokens recorded for Essay usage",
      icon: Coins,
    },
  ] as const;

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-border/60 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Plans &amp; growth
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Add-on Catalog
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Manage optional features that stack on paid plans. Control public
              catalog visibility, enable each add-on for sale, and issue
              complimentary grants when needed.
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground sm:justify-end">
            <div className="flex items-center gap-1.5">
              <dt>Registered</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {items.length}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>Active</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {activeCount}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt>Listed on Pricing</dt>
              <dd className="font-semibold tabular-nums text-foreground">
                {listedCount}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="space-y-3" aria-labelledby="ai-essay-usage-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className={adminSupportSectionLabelClass}>Usage overview</p>
            <h2
              id="ai-essay-usage-heading"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              AI Essay activity
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Snapshot of entitlements and generation activity for the AI Essay
              add-on.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 opacity-80" aria-hidden />
            AI Essay
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {usageMetrics.map(({ label, value, description, icon: Icon }) => (
            <Card key={label} className={cn(adminOverviewStatCardClass)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
                  {label}
                </CardTitle>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                  <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                  {value.toLocaleString()}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className={cn(adminSupportChartCardClass)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-tight">
              Event breakdown
            </CardTitle>
            <CardDescription>
              Counts by essay event type. Empty until the first generation runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {essayUsage.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                No essay events recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/50 rounded-lg border border-border/60 bg-background/40">
                {essayUsage.map((row) => (
                  <li
                    key={row.eventType}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                  >
                    <span className="font-medium text-foreground">
                      {formatEventType(row.eventType)}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {row.count.toLocaleString()} events
                      {row.tokensUsed > 0
                        ? ` · ${row.tokensUsed.toLocaleString()} tokens`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <AdminAddonCatalogDashboard
        pricingCatalogVisible={settings.pricingCatalogVisible}
        items={toClientJson(items)}
        users={toClientJson(assignableUsers)}
        entitlements={toClientJson(entitlementRows)}
      />
    </div>
  );
}
