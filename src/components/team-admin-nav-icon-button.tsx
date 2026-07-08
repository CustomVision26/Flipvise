"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { HeaderNavTooltip } from "@/components/header-nav-tooltip";
import { buttonVariants } from "@/components/ui/button-variants";
import { buildTeamAdminPath } from "@/lib/team-admin-url";
import { cn } from "@/lib/utils";

function resolveTeamAdminNavHref(searchParams: URLSearchParams): string {
  const team = searchParams.get("team");
  const teamMemberId = searchParams.get("teamMemberId");
  if (team != null || teamMemberId != null) {
    const teamId = team != null ? Number(team) : null;
    const memberId = teamMemberId != null ? Number(teamMemberId) : 0;
    return buildTeamAdminPath(
      teamId != null && Number.isFinite(teamId) && teamId > 0 ? teamId : null,
      Number.isFinite(memberId) ? memberId : 0,
    );
  }
  return buildTeamAdminPath();
}

export function TeamAdminNavIconButton({ className }: { className?: string }) {
  const searchParams = useSearchParams();

  return (
    <HeaderNavTooltip label="Back to team-admin dashboard">
      <Link
        href={resolveTeamAdminNavHref(searchParams)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "inline-flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-xs sm:px-3",
          className,
        )}
        aria-label="Back to team-admin dashboard"
      >
        <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
        <LayoutDashboard className="size-3.5 shrink-0 sm:hidden" aria-hidden />
        <span className="hidden sm:inline lg:hidden">Team Admin</span>
        <span className="hidden lg:inline">Back to team-admin dashboard</span>
      </Link>
    </HeaderNavTooltip>
  );
}
