"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { HeaderNavTooltip } from "@/components/header-nav-tooltip";
import { buttonVariants } from "@/components/ui/button-variants";
import { buildTeacherPath } from "@/lib/teacher-url";
import { cn } from "@/lib/utils";

function resolveTeacherNavHref(searchParams: URLSearchParams): string {
  const team = searchParams.get("team")?.trim();
  const teamMemberId = searchParams.get("teamMemberId")?.trim();
  const teamId =
    team && Number.isFinite(Number(team)) && Number(team) > 0
      ? Number(team)
      : null;
  if (teamId == null) {
    return buildTeacherPath();
  }
  const memberId =
    teamMemberId != null && Number.isFinite(Number(teamMemberId))
      ? Number(teamMemberId)
      : 0;
  return buildTeacherPath(teamId, memberId);
}

export function TeacherNavIconButton() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const active = pathname === "/teacher" || pathname.startsWith("/teacher/");

  return (
    <HeaderNavTooltip label="Teacher Dashboard">
      <Link
        href={resolveTeacherNavHref(searchParams)}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "inline-flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-xs sm:px-3",
          active && "bg-muted/70 text-foreground",
        )}
        aria-current={active ? "page" : undefined}
        aria-label="Teacher Dashboard"
      >
        <GraduationCap className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden min-[420px]:inline">Teacher</span>
      </Link>
    </HeaderNavTooltip>
  );
}
