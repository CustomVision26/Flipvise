import { AdminAboutEditor } from "@/components/admin-about-editor";
import { getAboutAdminState } from "@/db/queries/about-page";
import { assertAdminDashboardAccess } from "@/lib/admin/assert-admin-access";
import { readAppReleaseMetadata } from "@/lib/app-release-metadata";

export default async function AdminAboutPage() {
  await assertAdminDashboardAccess();
  const [state, release] = await Promise.all([
    getAboutAdminState(),
    Promise.resolve(readAppReleaseMetadata()),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <p className="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Website content
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">About Us</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Edit the public About Us page. Visitors only see content after you publish it. Team
          administrators cannot change this page.
        </p>
      </div>
      <AdminAboutEditor initial={state.draft} tableReady={state.tableReady} release={release} />
    </div>
  );
}
