"use client";

import * as React from "react";
import { Check, ChevronDown, Search, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildTeamAdminPath } from "@/lib/team-admin-url";

export type TeamSwitcherTeam = {
  id: number;
  name: string;
  /** Team-tier subscriber (team row `ownerUserId`) — for display / grouping only. */
  ownerUserId: string;
  /** Legacy `plan=` value from DB; not used in URLs anymore. */
  workspacePlanQuery?: string;
};

interface TeamSwitcherDropdownProps {
  teams: TeamSwitcherTeam[];
  selectedId: number;
  /** Optional id of helper text on the page for `aria-describedby` on the trigger. */
  ariaDescribedBy?: string;
  /** Hover hint for the trigger (e.g. on the admin dashboard header). */
  triggerTooltip?: string;
  /** Subscriber owner — link to workspace CRUD + history. */
  showManageWorkspaces?: boolean;
}

export function TeamSwitcherDropdown({
  teams,
  selectedId,
  ariaDescribedBy,
  triggerTooltip = "Choose which team to manage. Members, invites, and deck access on this page follow the team you select.",
  showManageWorkspaces = false,
}: TeamSwitcherDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = teams.find((t) => t.id === selectedId) ?? teams[0];

  if (teams.length === 0) {
    return null;
  }

  const q = query.trim().toLowerCase();
  const filteredTeams = React.useMemo(() => {
    if (q === "") return teams;
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, q]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  function selectTeam(teamId: number) {
    const row = teams.find((t) => t.id === teamId);
    if (!row) return;
    // Close the menu before navigation so portal teardown does not race React commit.
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => {
      router.push(buildTeamAdminPath(teamId));
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      {/* Do not nest Tooltip + DropdownMenuTrigger (two Base UI portals on one control breaks React teardown). */}
      <DropdownMenuTrigger
        render={(menuProps) => (
          <Button
            {...menuProps}
            variant="outline"
            size="sm"
            title={triggerTooltip}
            className={cn(
              "h-9 min-w-[12rem] max-w-full justify-between gap-2 px-3 font-normal",
              menuProps.className,
            )}
            aria-label={`Current team: ${selected?.name ?? "Team"}. Open menu to switch teams.`}
            aria-describedby={ariaDescribedBy}
          >
            <span className="truncate text-left">{selected?.name ?? "Team"}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        )}
      />
      <DropdownMenuContent align="start" className="w-72 p-0 sm:w-80 max-w-[calc(100vw-2rem)]">
        <div
          className="border-b border-border p-2"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search teams…"
              className="h-9 bg-background pl-9"
              autoComplete="off"
              aria-label="Search teams"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Your teams
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="my-1" />
            {filteredTeams.map((t) => {
              const isActive = t.id === selectedId;
              return (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => selectTeam(t.id)}
                  className="cursor-pointer gap-2"
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-foreground opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{t.name}</span>
                </DropdownMenuItem>
              );
            })}
            {filteredTeams.length === 0 && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                {q === "" ? "No teams." : "No teams match your search."}
              </p>
            )}
            {showManageWorkspaces && (
              <>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  className="cursor-pointer gap-2"
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    requestAnimationFrame(() => {
                      router.push("/dashboard/workspaces");
                    });
                  }}
                >
                  <Settings2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>Manage workspaces</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
