"use client";

import { useState, useTransition } from "react";
import { createAdminPlanAssignmentInviteAction } from "@/actions/admin";
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
  /** Resolved effective plan currently displayed to this user. */
  currentResolvedPlan?: string | null;
  /** Stripe-sourced plan slug (billingPlan metadata). */
  billingPlan?: string | null;
  /** Stripe subscription status (billingStatus metadata). */
  billingStatus?: string | null;
  /** ISO timestamp of last Stripe billing write. */
  billingPlanUpdatedAt?: string | null;
  /** Admin-assigned plan slug (adminPlan metadata). */
  adminPlan?: string | null;
  /** ISO timestamp of last admin plan assignment. */
  adminPlanUpdatedAt?: string | null;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function billingStatusBadge(status: string | null | undefined): { label: string; color: string } {
  switch (status) {
    case "active": return { label: "Active", color: "text-green-500" };
    case "trialing": return { label: "Trialing", color: "text-blue-500" };
    case "canceled": return { label: "Canceled", color: "text-destructive" };
    case "expired": return { label: "Expired", color: "text-destructive" };
    default: return { label: "None", color: "text-muted-foreground" };
  }
}

export function AssignUserPlanButton({
  targetUserId,
  targetUserName,
  targetUserEmail,
  isSelf,
  targetIsPlatformOwner,
  currentResolvedPlan,
  billingPlan,
  billingStatus,
  billingPlanUpdatedAt,
  adminPlan,
  adminPlanUpdatedAt,
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
        await createAdminPlanAssignmentInviteAction({
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
          <DropdownMenuTrigger
            render={(menuProps) => (
              <Button
                {...menuProps}
                type="button"
                variant="outline"
                size="xs"
                title="Please refresh page after selecting a plan"
                className={cn("gap-0.5 min-w-0", menuProps.className)}
                disabled={isPending}
                aria-label="Open assign plan menu"
              >
                {isPending ? "…" : "Assign plan"}
                <ChevronDown className="h-3 w-3 opacity-80" aria-hidden />
              </Button>
            )}
          />
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
            <AlertDialogTitle>Send plan assignment request</AlertDialogTitle>
            <AlertDialogDescription>
              The user will get an inbox message and must <strong>accept</strong> before any plan
              change is applied. If they have an active Stripe subscription, accepting may update
              their subscription with proration.
            </AlertDialogDescription>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              {/* ── Resolution context ── */}
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 space-y-2 text-xs">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Current plan state</p>
                {/* Resolved plan */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Resolved plan</span>
                  <span className="font-medium text-foreground">
                    {currentResolvedPlan && currentResolvedPlan !== "Free" ? currentResolvedPlan : "Free"}
                  </span>
                </div>
                {/* Billing source */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Stripe billing</span>
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{billingPlan ?? "—"}</span>
                    {billingStatus && (
                      <span className={cn("font-medium", billingStatusBadge(billingStatus).color)}>
                        ({billingStatusBadge(billingStatus).label})
                      </span>
                    )}
                  </span>
                </div>
                {billingPlanUpdatedAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Billing updated</span>
                    <span className="text-foreground">{fmtDate(billingPlanUpdatedAt)}</span>
                  </div>
                )}
                {/* Admin source */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Admin override</span>
                  <span className="font-medium text-foreground">{adminPlan ?? "—"}</span>
                </div>
                {adminPlanUpdatedAt && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Override set</span>
                    <span className="text-foreground">{fmtDate(adminPlanUpdatedAt)}</span>
                  </div>
                )}
                {/* What will happen */}
                {pending && (
                  <>
                    <div className="border-t border-border my-1" />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Plan if accepted</span>
                      <span className="font-semibold text-foreground">
                        {labelForAdminPlanAssignment(pending)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <p>
                Nothing changes on their account until they open the dashboard inbox and click{" "}
                <strong>Accept</strong>. They can also decline the request.
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
              {isPending ? "Sending…" : "Send request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
