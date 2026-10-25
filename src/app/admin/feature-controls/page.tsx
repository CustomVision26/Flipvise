import { assertAdminDashboardAccess } from "@/lib/admin/assert-admin-access";
import { getAdminAppearanceSettingsAction } from "@/actions/appearance";
import { AdminAppearanceControl } from "@/components/illustrated/admin-appearance-control";

export default async function AdminFeatureControlsPage() {
  await assertAdminDashboardAccess();

  let settings = null;
  let loadError: string | null = null;
  try {
    settings = await getAdminAppearanceSettingsAction();
  } catch {
    loadError =
      "Illustrated appearance settings are unavailable until migration drizzle/0079_illustrated_appearance.sql is applied. The standard design stays on.";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Feature Controls
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Feature Controls</h1>
      </div>
      {loadError ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground" role="status">
          {loadError}
        </p>
      ) : settings ? (
        <AdminAppearanceControl initial={settings} />
      ) : null}
    </div>
  );
}
