"use client";

import { useState, useTransition } from "react";
import { applyAdminUserPlanAssignmentAction } from "@/actions/admin";
import { AdminUserIdentityBlock } from "@/components/admin-user-identity-block";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ADMIN_PLAN_DROPDOWN_OPTIONS,
  type AdminPlanAssignment,
  labelForAdminPlanAssignment,
} from "@/lib/admin-assignable-plans";
import { ChevronDown, ShieldAlert } from "lucide-react";

type AssignUserPlanButtonProps = {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string | null;
  isSelf: boolean;
  targetIsPlatformOwner: boolean;
};

export function AssignUserPlanButton({
  targetUserId,
  targetUserName,
  targetUserEmail,
  isSelf,
  targetIsPlatformOwner,
}: AssignUserPlanButtonProps) {
  const [pending, setPending] = useState<AdminPlanAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isSelf) {
    return null;
  }

  if (targetIsPlatformOwner) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={(p) => (
              <span {...p} className={cn("inline-flex", p.className)} tabIndex={0} />
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled
              className="gap-0.5"
              aria-label="Assign plan (not available for platform owner)"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>The platform owner&apos;s plan metadata cannot be changed here.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  function onConfirm() {
    if (!pending) return;
    setError(null);
    startTransition(async () => {
      try {
        await applyAdminUserPlanAssignmentAction({
          targetUserId,
          assignment: pending,
        });
        setPending(null);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to update plan. Try again.",
        );
      }
    });
  }

  return (
    <>
      <div className="inline-flex flex-col items-start gap-0.5">
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={(tipProps) => (
                  <DropdownMenuTrigger
                    {...tipProps}
                    render={(menuProps) => (
                      <Button
                        {...menuProps}
                        type="button"
                        variant="outline"
                        size="xs"
                        className={cn("gap-0.5 min-w-0", menuProps.className)}
                        disabled={isPending}
                        aria-label="Open assign plan menu"
                      >
                        {isPending ? "…" : "Assign plan"}
                        <ChevronDown className="h-3 w-3 opacity-80" aria-hidden />
                      </Button>
                    )}
                  />
                )}
              />
              <TooltipContent className="max-w-xs text-left" side="top">
                <p>Please refresh page after selecting a plan</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Clear &amp; personal</DropdownMenuLabel>
              {ADMIN_PLAN_DROPDOWN_OPTIONS.base.map((row) => (
                <DropdownMenuItem
                  key={row.id}
                  onClick={() => {
                    setError(null);
                    setPending(row.id);
                  }}
                  disabled={isPending}
                  variant={row.id === "free" ? "destructive" : "default"}
                >
                  {row.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Team tiers</DropdownMenuLabel>
              {ADMIN_PLAN_DROPDOWN_OPTIONS.team.map((row) => (
                <DropdownMenuItem
                  key={row.id}
                  onClick={() => {
                    setError(null);
                    setPending(row.id);
                  }}
                  disabled={isPending}
                >
                  {row.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {error && (
          <p className="text-[0.7rem] text-destructive max-w-[8rem] leading-tight">
            {error}
          </p>
        )}
      </div>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (!isPending) setPending(null);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm plan assignment</AlertDialogTitle>
            <AlertDialogDescription>
              This updates Clerk <strong>public metadata</strong> for the user
              below. It does <strong>not</strong> create or cancel paid
              subscriptions in the Clerk Dashboard.
            </AlertDialogDescription>
            <div className="space-y-2 text-left text-sm text-muted-foreground">
              {pending && (
                <p className="text-foreground font-medium">
                  Selection: {labelForAdminPlanAssignment(pending)}
                </p>
              )}
              <p>
                The in-app and admin &ldquo;Plan&rdquo; row reads these fields. Real
                billing and invoices are unchanged. The user may need a new
                session for Clerk&rsquo;s <code className="text-xs">has()</code> plan
                checks to match&mdash;ask them to sign out and back in if
                entitlements look wrong.
              </p>
              <AdminUserIdentityBlock
                name={targetUserName}
                email={targetUserEmail}
                userId={targetUserId}
              />
            </div>
          </AlertDialogHeader>
          {error && (
            <p className="px-6 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (!isPending) setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={isPending}
            >
              {isPending ? "Applying…" : "Apply assignment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
