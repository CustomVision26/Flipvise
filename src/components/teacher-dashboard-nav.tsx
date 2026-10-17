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

function navAccent(suffix: string) {
  switch (suffix) {
    case "/lesson-builder":
      return {
        chip: "bg-emerald-500/20 text-emerald-100 ring-emerald-300/45",
        active:
          "border-emerald-400/40 bg-emerald-500/15 text-foreground shadow-[0_10px_28px_-14px_rgba(16,185,129,0.95)]",
        idle: "hover:border-emerald-400/25 hover:bg-emerald-500/10",
      };
    case "/quizzes":
      return {
        chip: "bg-violet-500/20 text-violet-100 ring-violet-300/45",
        active:
          "border-violet-400/40 bg-violet-500/15 text-foreground shadow-[0_10px_28px_-14px_rgba(139,92,246,0.95)]",
        idle: "hover:border-violet-400/25 hover:bg-violet-500/10",
      };
    case "/homework":
      return {
        chip: "bg-amber-500/20 text-amber-50 ring-amber-300/45",
        active:
          "border-amber-400/40 bg-amber-500/12 text-foreground shadow-[0_10px_28px_-14px_rgba(245,158,11,0.9)]",
        idle: "hover:border-amber-400/25 hover:bg-amber-500/10",
      };
    case "/study-guides":
      return {
        chip: "bg-sky-500/20 text-sky-50 ring-sky-300/45",
        active:
          "border-sky-400/40 bg-sky-500/15 text-foreground shadow-[0_10px_28px_-14px_rgba(14,165,233,0.95)]",
        idle: "hover:border-sky-400/25 hover:bg-sky-500/10",
      };
    case "/worksheets":
      return {
        chip: "bg-rose-500/20 text-rose-50 ring-rose-300/45",
        active:
          "border-rose-400/40 bg-rose-500/12 text-foreground shadow-[0_10px_28px_-14px_rgba(244,63,94,0.9)]",
        idle: "hover:border-rose-400/25 hover:bg-rose-500/10",
      };
    default:
      return {
        chip: "bg-primary/15 text-primary ring-primary/30",
        active: "border-primary/40 bg-primary/15 text-foreground shadow-[0_10px_28px_-14px_rgba(99,102,241,0.8)]",
        idle: "hover:border-primary/25 hover:bg-primary/10",
      };
  }
}

function navLinkClass(active: boolean, accent: ReturnType<typeof navAccent>) {
  return cn(
    "group flex items-start gap-2.5 rounded-xl border px-2 py-2 text-sm transition-all duration-200",
    active
      ? cn("font-medium", accent.active)
      : cn(
          "border-transparent text-muted-foreground hover:translate-x-0.5 hover:text-foreground",
          accent.idle,
        ),
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

  const overviewAccent = navAccent("");

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
          className={navLinkClass(overviewActive, overviewAccent)}
          onClick={onNavigate}
          aria-current={overviewActive ? "page" : undefined}
          title="/teacher"
        >
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-200 group-hover:scale-105",
              overviewAccent.chip,
              overviewActive && "scale-105",
            )}
          >
            <LayoutDashboard className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">Dashboard</span>
            <span className="block truncate text-[10px] font-normal text-muted-foreground/80">
              /teacher
            </span>
          </span>
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
              const active = isTeacherNavItemActive(
                pathname,
                item.suffix,
                item.absoluteHref,
              );
              const Icon = item.icon;
              const accent = navAccent(item.suffix);
              const path =
                item.absoluteHref ??
                `/teacher${item.suffix.startsWith("/") ? item.suffix : `/${item.suffix}`}`;
              const href = item.absoluteHref ?? buildTeacherToolHref(item.suffix, workspace);
              return (
                <li key={`${section.title}-${item.title}`}>
                  <Link
                    href={href}
                    className={navLinkClass(active, accent)}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={path}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-200 group-hover:scale-105",
                        accent.chip,
                        active && "scale-105",
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.title}</span>
                      <span className="block truncate text-[10px] font-normal text-muted-foreground/80">
                        {path}
                      </span>
                    </span>
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
        "overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-card/90 via-card/75 to-card/60 p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_36px_-20px_rgba(0,0,0,0.55)] backdrop-blur-md",
        className,
      )}
    >
      <div
        aria-hidden
        className="h-1 bg-gradient-to-r from-emerald-400 via-violet-400 to-rose-400"
      />
      <TeacherDashboardNav onNavigate={onNavigate} className="p-3" />
    </div>
  );
}
