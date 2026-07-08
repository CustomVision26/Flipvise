"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import {
  isTeacherNavItemActive,
  TEACHER_DASHBOARD_NAV,
} from "@/lib/teacher-dashboard-nav";
import {
  buildTeacherPath,
  buildTeacherQueryString,
  buildTeacherToolHref,
  TEACHER_PATH,
  type TeacherWorkspaceContext,
} from "@/lib/teacher-url";
import { cn } from "@/lib/utils";

function useTeacherNavWorkspace(): TeacherWorkspaceContext {
  const searchParams = useSearchParams();
  const teamRaw = searchParams.get("team")?.trim();
  const memberRaw = searchParams.get("teamMemberId")?.trim();
  const teamId =
    teamRaw && Number.isFinite(Number(teamRaw)) && Number(teamRaw) > 0
      ? Number(teamRaw)
      : null;
  const teamMemberId =
    memberRaw != null && Number.isFinite(Number(memberRaw)) && Number(memberRaw) >= 0
      ? Number(memberRaw)
      : 0;
  const queryString = buildTeacherQueryString(teamId, teamMemberId);
  return { teamId, teamMemberId, queryString };
}

function navLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
    active
      ? "bg-primary/15 font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
  );
}

export function TeacherDashboardNav({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const workspace = useTeacherNavWorkspace();
  const overviewActive = pathname === TEACHER_PATH;

  return (
    <nav
      aria-label="Teacher dashboard"
      className={cn("flex flex-col gap-5", className)}
    >
      <div>
        <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Overview
        </p>
        <Link
          href={buildTeacherPath(workspace.teamId, workspace.teamMemberId)}
          className={navLinkClass(overviewActive)}
          onClick={onNavigate}
          aria-current={overviewActive ? "page" : undefined}
        >
          <LayoutDashboard className="size-4 shrink-0" aria-hidden />
          Dashboard
        </Link>
      </div>

      {TEACHER_DASHBOARD_NAV.map((section, sectionIndex) => (
        <div key={section.title}>
          {sectionIndex > 0 ? <Separator className="mb-5 bg-border/60" /> : null}
          <div className="mb-2 space-y-0.5 px-2.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {section.title}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground/80">
              {section.description}
            </p>
          </div>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isTeacherNavItemActive(pathname, item.suffix);
              const Icon = item.icon;
              return (
                <li key={`${section.title}-${item.title}`}>
                  <Link
                    href={buildTeacherToolHref(item.suffix, workspace)}
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
        </div>
      ))}
    </nav>
  );
}

export function TeacherDashboardNavPanel({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        teamAdminCardClass,
        "rounded-xl border border-border/80 bg-card/80 p-3 backdrop-blur-sm",
        className,
      )}
    >
      <TeacherDashboardNav onNavigate={onNavigate} />
    </div>
  );
}
