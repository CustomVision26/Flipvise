"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminOverviewMetricsLabelClass,
  adminOverviewMetricsShellClass,
  adminOverviewMetricsToggleClass,
} from "@/components/admin-panel-styles";
import { cn } from "@/lib/utils";

/** Admin sections where the dashboard overview stat row can be folded away. */
const STATS_TOGGLE_ROUTES = new Set([
  "/admin",
  "/admin/marketing-affiliates",
  "/admin/plans",
  "/admin/support-center",
  "/admin/admin-roles",
  "/admin/invoices",
  "/admin/subscription",
  "/admin/team-workspaces",
  "/admin/all-users",
]);

const OVERVIEW_METRICS_EXPANDED_STORAGE_KEY = "flipvise-admin-overview-metrics-expanded";

function readStoredExpanded(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OVERVIEW_METRICS_EXPANDED_STORAGE_KEY);
    if (raw === null) return null;
    return raw === "1";
  } catch {
    return null;
  }
}

function writeStoredExpanded(expanded: boolean) {
  try {
    sessionStorage.setItem(OVERVIEW_METRICS_EXPANDED_STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    /* private / quota */
  }
}

type OverviewMetricsContextValue = {
  eligible: boolean;
  open: boolean;
  toggle: () => void;
  panelId: string;
};

const OverviewMetricsContext = createContext<OverviewMetricsContextValue | null>(null);

function useOverviewMetricsContext() {
  const ctx = useContext(OverviewMetricsContext);
  if (!ctx) {
    throw new Error(
      "Admin overview metrics components must be used within AdminOverviewMetricsProvider.",
    );
  }
  return ctx;
}

export function AdminOverviewMetricsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const panelId = useId();
  const eligible = STATS_TOGGLE_ROUTES.has(pathname);
  const [open, setOpen] = useState(true);

  useLayoutEffect(() => {
    const stored = readStoredExpanded();
    if (stored !== null) {
      setOpen(stored);
      return;
    }
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setOpen(false);
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      writeStoredExpanded(next);
      return next;
    });
  }, []);

  const value: OverviewMetricsContextValue = { eligible, open, toggle, panelId };

  return (
    <OverviewMetricsContext.Provider value={value}>{children}</OverviewMetricsContext.Provider>
  );
}

/** Toggle for overview stat cards — render in the admin header on deep-link routes. */
export function AdminOverviewMetricsToggle() {
  const { eligible, open, toggle, panelId } = useOverviewMetricsContext();
  if (!eligible) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(adminOverviewMetricsToggleClass, "w-fit shrink-0")}
      aria-expanded={open}
      aria-controls={panelId}
      onClick={toggle}
    >
      {open ? (
        <ChevronUp className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      ) : (
        <ChevronDown className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      )}
      Overview metrics
    </Button>
  );
}

/** Collapsible wrapper for the stat card grid — pairs with AdminOverviewMetricsToggle. */
export function AdminOverviewMetricsPanel({ children }: { children: ReactNode }) {
  const { eligible, open, panelId } = useOverviewMetricsContext();
  if (!eligible) {
    return (
      <div className={adminOverviewMetricsShellClass}>
        <p className={adminOverviewMetricsLabelClass}>Overview metrics</p>
        {children}
      </div>
    );
  }

  return (
    <div
      id={panelId}
      className={cn(
        "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-in-out",
        open
          ? "mb-0 grid-rows-[1fr] opacity-100"
          : "mb-0 grid-rows-[0fr] opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            adminOverviewMetricsShellClass,
            open && "animate-in fade-in-0 slide-in-from-top-2 duration-300 fill-mode-both",
          )}
        >
          <p className={adminOverviewMetricsLabelClass}>Overview metrics</p>
          {children}
        </div>
      </div>
    </div>
  );
}
