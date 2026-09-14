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
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceCreateProfileFields } from "@/components/workspace-create-profile-fields";
import { createTeamAction } from "@/actions/teams";
import { isProductionOmittedServerError } from "@/lib/server-action-client-error";
import type { WorkspaceCreatePlanId } from "@/lib/education-plans";
import {
  EMPTY_WORKSPACE_CREATE_DRAFT,
  previewWorkspaceName,
  workspaceCreateProfileSchema,
  type WorkspaceCreateDraft,
} from "@/lib/workspace-creation-profile";

interface AddTeamDialogProps {
  planSlug: WorkspaceCreatePlanId;
  isAtLimit?: boolean;
  triggerLabel?: string;
  /** Shown on hover. Omit to use the default help text. Pass `""` to disable. */
  triggerTooltip?: string;
  existingWorkspaceNames?: string[];
}

const DEFAULT_ADD_WORKSPACE_TOOLTIP =
  "Create a new team workspace on your plan. You can invite members after it is created.";

export function AddTeamDialog({
  planSlug,
  isAtLimit = false,
  triggerLabel = "Add Workspace",
  triggerTooltip = DEFAULT_ADD_WORKSPACE_TOOLTIP,
  existingWorkspaceNames = [],
}: AddTeamDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<WorkspaceCreateDraft>(() => ({
    ...EMPTY_WORKSPACE_CREATE_DRAFT,
  }));
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const canSubmit = previewWorkspaceName(draft).length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = workspaceCreateProfileSchema.safeParse(draft);
    if (!parsed.success) {
      setError("Choose an option and fill in every required field.");
      return;
    }

    setIsPending(true);
    try {
      const result = await createTeamAction({
        ...parsed.data,
        planSlug,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setDraft({ ...EMPTY_WORKSPACE_CREATE_DRAFT });
      router.push("/dashboard/workspaces");
      router.refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(
        raw && !isProductionOmittedServerError(raw)
          ? raw
          : "Could not create the workspace. Please try again.",
      );
    } finally {
      setIsPending(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
      if (!nextOpen) {
        setError(null);
        setDraft({ ...EMPTY_WORKSPACE_CREATE_DRAFT });
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Create a team</DialogTitle>
          <DialogDescription className="text-sm">
            Choose who this workspace is for. Flipvise builds a unique name from your
            details. You can invite members after it is created.
          </DialogDescription>
        </DialogHeader>

        <form id="add-team-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ScrollArea className="max-h-[min(70vh,32rem)] pr-3">
            <WorkspaceCreateProfileFields
              idPrefix="add-team"
              draft={draft}
              onChange={setDraft}
              disabled={isPending}
              existingWorkspaceNames={existingWorkspaceNames}
              nestedInModal
            />
          </ScrollArea>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />} disabled={isPending}>
            Cancel
          </DialogClose>
          <Button
            type="submit"
            form="add-team-form"
            disabled={isPending || !canSubmit}
          >
            {isPending ? "Creating…" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
