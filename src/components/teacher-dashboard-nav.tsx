"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
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

function navAccent(suffix: string) {
  switch (suffix) {
    case "/homework":
      return "amber";
    case "/study-guides":
    case "/students":
      return "sky";
    case "/worksheets":
      return "rose";
    case "/lesson-builder":
      return "emerald";
    default:
      return "violet";
  }
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
      className={cn("flex flex-col gap-4", className)}
    >
      <div>
        <p className="teacher-nav-kicker">Dashboard</p>
        <Link
          href={buildTeacherPath(workspace.teamId, workspace.teamMemberId)}
          className="teacher-nav-link"
          data-accent="violet"
          onClick={onNavigate}
          aria-current={overviewActive ? "page" : undefined}
          title="/teacher"
        >
          <LayoutDashboard className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">Dashboard</span>
        </Link>
      </div>

      {TEACHER_DASHBOARD_NAV.map((section) => (
        <div key={section.title}>
          <p className="teacher-nav-kicker">{section.title}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isTeacherNavItemActive(
                pathname,
                item.suffix,
                item.absoluteHref,
              );
              const Icon = item.icon;
              const path =
                item.absoluteHref ??
                `/teacher${item.suffix.startsWith("/") ? item.suffix : `/${item.suffix}`}`;
              const currentTeacherPath = workspace.queryString
                ? `${pathname}?${workspace.queryString}`
                : pathname;
              const href = item.absoluteHref
                ? `${item.absoluteHref}?returnTo=${encodeURIComponent(currentTeacherPath)}`
                : buildTeacherToolHref(item.suffix, workspace);
              return (
                <li key={`${section.title}-${item.title}`}>
                  <Link
                    href={href}
                    className="teacher-nav-link"
                    data-accent={navAccent(item.suffix)}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={path}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="teacher-nav-hint">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
        Select any item to begin
      </p>
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
        "lesson-studio-nav overflow-hidden rounded-2xl p-0",
        className,
      )}
    >
      <TeacherDashboardNav onNavigate={onNavigate} className="p-3" />
    </div>
  );
}
