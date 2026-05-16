import {
  AdminOverviewStatsSkeleton,
  AdminTabsPanelSkeleton,
} from "@/components/admin/admin-dashboard-skeletons";

export default function AdminLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-8 p-4 sm:p-8">
      <div className="space-y-2">
        <div className="h-9 w-56 rounded-md bg-muted animate-pulse" aria-hidden />
        <div className="h-5 w-72 max-w-full rounded-md bg-muted animate-pulse" />
      </div>
      <AdminOverviewStatsSkeleton />
      <AdminTabsPanelSkeleton />
    </div>
  );
}
