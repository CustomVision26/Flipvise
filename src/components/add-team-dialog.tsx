"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeamAction } from "@/actions/teams";
import { buildTeamWorkspaceDashboardPath } from "@/lib/team-workspace-url";
import type { TeamPlanId } from "@/lib/team-plans";

interface AddTeamDialogProps {
  planSlug: TeamPlanId;
  isAtLimit?: boolean;
  triggerLabel?: string;
  /** Shown on hover. Omit to use the default help text. Pass `""` to disable. */
  triggerTooltip?: string;
}

const DEFAULT_ADD_WORKSPACE_TOOLTIP =
  "Create a new team workspace on your plan. You can invite members after it is created.";

export function AddTeamDialog({
  planSlug,
  isAtLimit = false,
  triggerLabel = "Add Workspace",
  triggerTooltip = DEFAULT_ADD_WORKSPACE_TOOLTIP,
}: AddTeamDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Team name is required.");
      return;
    }

    setIsPending(true);
    try {
      const { teamId } = await createTeamAction({
        name: trimmed,
        planSlug,
      });
      setOpen(false);
      setName("");
      router.push(
        buildTeamWorkspaceDashboardPath({
          teamId,
        }),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create team.");
    } finally {
      setIsPending(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
      if (!nextOpen) {
        setError(null);
        setName("");
      }
    }
  }

  if (isAtLimit) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={(props) => (
            <Link
              href="/pricing"
              {...props}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                props.className,
              )}
            >
              Upgrade for more teams
            </Link>
          )}
        />
        <TooltipContent side="top" className="max-w-xs text-center">
          You&apos;ve reached the workspace limit for your team plan. Open Pricing to compare tiers
          and add more team workspaces.
        </TooltipContent>
      </Tooltip>
    );
  }

  const showTriggerTooltip = triggerTooltip.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {showTriggerTooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <DialogTrigger
                  {...props}
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(props.className)}
                    />
                  }
                >
                  {triggerLabel}
                </DialogTrigger>
              )}
            />
            <TooltipContent side="top" className="max-w-xs text-balance text-center">
              {triggerTooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          {triggerLabel}
        </DialogTrigger>
      )}
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Create a team</DialogTitle>
          <DialogDescription className="text-sm">
            Name your team. You can invite members after it is created.
          </DialogDescription>
        </DialogHeader>

        <form id="add-team-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-team-name">Team name</Label>
            <Input
              id="new-team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science department"
              disabled={isPending}
              maxLength={255}
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />} disabled={isPending}>
            Cancel
          </DialogClose>
          <Button type="submit" form="add-team-form" disabled={isPending}>
            {isPending ? "Creating…" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
