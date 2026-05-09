"use client";

import type { ReactNode } from "react";
import { useCallback, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Admin sections where the dashboard overview stat row can be folded away. */
const STATS_TOGGLE_ROUTES = new Set([
  "/admin/marketing-affiliates",
  "/admin/plans",
  "/admin/support-center",
  "/admin/admin-roles",
  "/admin/invoices",
  "/admin/subscription",
  "/admin/team-workspaces",
  "/admin/all-users",
]);

export function AdminOverviewStatsCollapsible({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const panelId = useId();
  const eligible = STATS_TOGGLE_ROUTES.has(pathname);
  const [open, setOpen] = useState(true);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  if (!eligible) return children;

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 w-fit gap-2 text-xs sm:text-sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
        )}
        Overview metrics
      </Button>
      <div id={panelId} className={cn(!open && "hidden")}>
        {children}
      </div>
    </div>
  );
}
