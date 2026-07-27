import {
  AdminAddonCatalogDashboard,
  type AdminAddonCatalogItem,
} from "@/components/admin-addon-catalog-dashboard";
import {
  getAddonCatalogSettings,
  listAddonCatalog,
} from "@/db/queries/addons";
import { resolveStripeAddonPriceIdFromEnvKey } from "@/lib/stripe-addon-price-env";
import { toClientJson } from "@/lib/to-client-json";

export const dynamic = "force-dynamic";

export default async function AdminAddOnsPage() {
  const [settings, catalog] = await Promise.all([
    getAddonCatalogSettings(),
    listAddonCatalog(),
  ]);

  const items: AdminAddonCatalogItem[] = catalog.map((row) => ({
    ...row,
    stripePriceConfigured: Boolean(
      resolveStripeAddonPriceIdFromEnvKey(row.stripePriceEnvKey),
    ),
  }));

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
          Administer optional monthly features that stack on base subscriptions.
          Control public pricing visibility, catalog enablement, and complimentary
          grants for individual accounts.
        </p>
      </header>
      <AdminAddonCatalogDashboard
        pricingCatalogVisible={settings.pricingCatalogVisible}
        items={toClientJson(items)}
      />
    </div>
  );
}
