"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ESSAY_DASHBOARD_NAV,
  isEssayNavItemActive,
} from "@/lib/essay-dashboard-nav";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";

export function EssayDashboardShell({
  children,
  unlocked,
}: {
  children: React.ReactNode;
  unlocked: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:gap-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Premium add-on
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">AI Essay</h1>
        </div>
        <Badge variant={unlocked ? "secondary" : "outline"}>
          {unlocked ? "Unlocked" : "Locked"}
        </Badge>
      </div>

      {unlocked ? (
        <nav className="flex flex-wrap gap-2" aria-label="AI Essay navigation">
          {ESSAY_DASHBOARD_NAV.map((item) => {
            const active = isEssayNavItemActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    size: "sm",
                    variant: active ? "default" : "outline",
                  }),
                )}
              >
                <item.icon className="size-3.5" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {children}
    </div>
  );
}
