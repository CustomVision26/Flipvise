"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import {
  TEAM_ADMIN_DASHBOARD_NAV,
  isTeamAdminOverviewActive,
  type TeamAdminNavItem,
  type TeamAdminNavLeaf,
} from "@/lib/team-admin-dashboard-nav";
import {
  buildTeamAdminLiveClassroomPath,
  buildTeamAdminMembersPath,
  buildTeamAdminNavHref,
  TEAM_ADMIN_LIVE_CLASSROOM_PATH,
} from "@/lib/team-admin-url";
import { cn } from "@/lib/utils";

function useTeamAdminNavWorkspace() {
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
  return { teamId, teamMemberId };
}

function navLinkClass(active: boolean) {
  return cn(
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
    active
      ? "bg-primary/15 font-medium text-foreground"
      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
  );
}

function hrefForNavLeaf(
  item: TeamAdminNavLeaf,
  teamId: number | null,
  teamMemberId: number,
): string {
  if (item.path === TEAM_ADMIN_LIVE_CLASSROOM_PATH) {
    return buildTeamAdminLiveClassroomPath(teamId);
  }
  return buildTeamAdminNavHref(item.path, teamId, teamMemberId);
}

function TeamAdminNavDropdownItem({
  item,
  teamId,
  teamMemberId,
  onNavigate,
}: {
  item: TeamAdminNavItem & { subItems: TeamAdminNavLeaf[] };
  teamId: number | null;
  teamMemberId: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const parentActive = item.isActive(pathname);
  const Icon = item.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(menuProps) => (
          <button
            {...menuProps}
            type="button"
            className={cn(navLinkClass(parentActive), menuProps.className)}
            aria-current={parentActive ? "true" : undefined}
          >
            <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
            <ChevronDown
              className="size-3.5 shrink-0 opacity-70"
              aria-hidden
            />
          </button>
        )}
      />
      <DropdownMenuContent
        align="start"
        side="right"
        sideOffset={6}
        className="min-w-48"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
          {item.subItems.map((sub) => {
            const active = sub.isActive(pathname);
            const SubIcon = sub.icon;
            const href = hrefForNavLeaf(sub, teamId, teamMemberId);
            return (
              <DropdownMenuItem
                key={sub.path}
                render={<Link href={href} />}
                className={cn(
                  "cursor-pointer gap-2",
                  active && "bg-accent font-medium text-accent-foreground",
                )}
                onClick={onNavigate}
              >
                <SubIcon className="size-3.5 opacity-80" aria-hidden />
                <span className="truncate">{sub.title}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TeamAdminDashboardNav({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname() ?? "";
  const { teamId, teamMemberId } = useTeamAdminNavWorkspace();
  const overviewActive = isTeamAdminOverviewActive(pathname);

  return (
    <nav
      aria-label="Team admin dashboard"
      className={cn("flex flex-col gap-5", className)}
    >
      <div>
        <p className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Overview
        </p>
        <Link
          href={buildTeamAdminMembersPath(teamId, teamMemberId)}
          className={navLinkClass(overviewActive)}
          onClick={onNavigate}
          aria-current={overviewActive ? "page" : undefined}
        >
          <LayoutDashboard className="size-4 shrink-0" aria-hidden />
          Team admin home
        </Link>
      </div>

      {TEAM_ADMIN_DASHBOARD_NAV.map((section, sectionIndex) => (
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
              if (item.subItems && item.subItems.length > 0) {
                return (
                  <li key={`${section.title}-${item.title}`}>
                    <TeamAdminNavDropdownItem
                      item={item as TeamAdminNavItem & { subItems: TeamAdminNavLeaf[] }}
                      teamId={teamId}
                      teamMemberId={teamMemberId}
                      onNavigate={onNavigate}
                    />
                  </li>
                );
              }

              const active = item.isActive(pathname);
              const Icon = item.icon;
              const href = hrefForNavLeaf(item, teamId, teamMemberId);
              return (
                <li key={`${section.title}-${item.title}`}>
                  <Link
                    href={href}
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

export function TeamAdminDashboardNavPanel({
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
      <TeamAdminDashboardNav onNavigate={onNavigate} />
    </div>
  );
}
