import {
  AdminAddonCatalogDashboard,
  type AdminAddonCatalogItem,
} from "@/components/admin-addon-catalog-dashboard";
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
  listAddonCatalog,
} from "@/db/queries/addons";
import {
  countEssayUsageByType,
  listActiveEssayUserIds,
} from "@/db/queries/essays";
import { getAdminClerkUserList } from "@/lib/admin/admin-clerk-cache";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";
import { toClientJson } from "@/lib/to-client-json";

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

export default async function AdminAddOnsPage() {
  const [settings, catalog, essayUsage, essayUsers, essayEntitlements, clerkUsers] =
    await Promise.all([
      getAddonCatalogSettings(),
      listAddonCatalog(),
      countEssayUsageByType(),
      listActiveEssayUserIds(),
      listActiveEntitlementsForAddon(AI_ESSAY_ADDON_KEY),
      getAdminClerkUserList(),
    ]);

  const items: AdminAddonCatalogItem[] = catalog.map((row) => ({
    ...row,
    stripePriceConfigured: Boolean(
      resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey),
    ),
  }));

  const assignableUsers = clerkUsers.data
    .map((user) => {
      const email =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
          ?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;
      return {
        userId: user.id,
        name: clerkUserDisplayName(user),
        email,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const tokensUsed = essayUsage.reduce((sum, row) => sum + row.tokensUsed, 0);

  return (
    <div className="space-y-6">
      <header className="space-y-1.5 border-b border-border/60 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Plans &amp; growth
        </p>
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Add-on Catalog
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Administer optional features that stack on base subscriptions. Control
          public pricing visibility, catalog enablement, and complimentary grants.
          Team Admins can also assign add-ons from Team Admin → Add-ons.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Essay usage</CardTitle>
          <CardDescription>
            Active entitlements, users with events, and AI token totals.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Active Essay users</p>
            <p className="text-2xl font-semibold tabular-nums">
              {essayEntitlements.length}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Users with activity</p>
            <p className="text-2xl font-semibold tabular-nums">{essayUsers.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">AI tokens tracked</p>
            <p className="text-2xl font-semibold tabular-nums">{tokensUsed}</p>
          </div>
          <ul className="sm:col-span-3 space-y-1 text-muted-foreground">
            {essayUsage.length === 0 ? (
              <li>No essay events recorded yet.</li>
            ) : (
              essayUsage.map((row) => (
                <li key={row.eventType}>
                  {row.eventType}: {row.count} events
                  {row.tokensUsed > 0 ? ` · ${row.tokensUsed} tokens` : ""}
                </li>
              ))
            )}
          </ul>
        </CardContent>
      </Card>

      <AdminAddonCatalogDashboard
        pricingCatalogVisible={settings.pricingCatalogVisible}
        items={toClientJson(items)}
        users={toClientJson(assignableUsers)}
      />
    </div>
  );
}
