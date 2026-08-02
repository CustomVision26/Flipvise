"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LIVE_CLASSROOM_NAV } from "@/lib/live-classroom-nav";
import { buildLiveClassroomHref } from "@/lib/live-classroom-url";
import { cn } from "@/lib/utils";

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
    active
      ? "bg-primary/15 font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
  );
}

export function LiveClassroomNav({
  teamId,
  onNavigate,
  className,
}: {
  teamId: number;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Live Classroom navigation"
      className={cn("flex flex-col gap-0.5", className)}
    >
      <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Live Classroom™
      </p>
      <ul className="flex flex-col gap-0.5">
        {LIVE_CLASSROOM_NAV.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <li key={item.path}>
              <Link
                href={buildLiveClassroomHref(item.path, teamId)}
                className={navLinkClass(active)}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                <span className="min-w-0 truncate">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
