"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminTabsProps } from "@/components/admin-tabs";

const AdminTabsLazy = dynamic(
  () => import("@/components/admin-tabs").then((m) => m.AdminTabs),
  {
    ssr: false,
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

export function AdminTabsDynamic(props: AdminTabsProps) {
  return <AdminTabsLazy {...props} />;
}
