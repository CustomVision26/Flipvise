"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type LiveClassroomTeamTargetOption = {
  id: number;
  name: string;
};

type LiveClassroomTeamTargetMenuProps = {
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  pending?: boolean;
  teams: LiveClassroomTeamTargetOption[];
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  onSelect: (target: "all" | number) => void;
};

export function LiveClassroomTeamTargetMenu({
  label,
  icon,
  disabled,
  pending,
  teams,
  variant = "outline",
  size = "default",
  className,
  onSelect,
}: LiveClassroomTeamTargetMenuProps) {
  const activeTeams = teams.filter((t) => t.name.trim().length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            disabled={disabled || pending || activeTeams.length === 0}
            variant={variant}
            size={size}
            className={cn("gap-1.5", className)}
          />
        }
      >
        {icon}
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel>Apply to</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSelect("all")} disabled={pending}>
          All teams
        </DropdownMenuItem>
        {activeTeams.map((team) => (
          <DropdownMenuItem
            key={team.id}
            onClick={() => onSelect(team.id)}
            disabled={pending}
          >
            {team.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
