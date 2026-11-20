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
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Education tiers</DropdownMenuLabel>
              {ADMIN_PLAN_DROPDOWN_OPTIONS.education.map((row) => (
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
        <AlertDialogContent
          data-flipvise-plan-assign-dialog=""
          className="gap-4 border-2 p-5 text-left"
        >
          <AlertDialogHeader className="flex flex-col items-start gap-3 text-left">
            <AlertDialogTitle className="text-lg font-semibold leading-snug">
              Send plan assignment request
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-relaxed">
              The user will get an inbox message and must <strong>accept</strong> before any plan
              change is applied. If they have an active Stripe subscription, accepting may update
              their subscription with proration.
            </AlertDialogDescription>
            <div className="w-full space-y-3 text-left text-sm">
              <div className="plan-assign-panel space-y-2 px-3 py-2.5 text-sm">
                <p className="plan-assign-kicker">Current plan state</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="plan-assign-label">Resolved plan</span>
                  <span className="plan-assign-value">
                    {currentResolvedPlan && currentResolvedPlan !== "Free" ? currentResolvedPlan : "Free"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="plan-assign-label">Stripe billing</span>
                  <span className="flex items-center gap-1.5">
                    <span className="plan-assign-value">{billingPlan ?? "—"}</span>
                    {billingStatus && (
                      <span className={cn("plan-assign-status", billingStatusBadge(billingStatus).color)}>
                        ({billingStatusBadge(billingStatus).label})
                      </span>
                    )}
                  </span>
                </div>
                {billingPlanUpdatedAt && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="plan-assign-label">Billing updated</span>
                    <span className="plan-assign-value">{fmtDate(billingPlanUpdatedAt)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="plan-assign-label">Admin override</span>
                  <span className="plan-assign-value">{adminPlan ?? "—"}</span>
                </div>
                {adminPlanUpdatedAt && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="plan-assign-label">Override set</span>
                    <span className="plan-assign-value">{fmtDate(adminPlanUpdatedAt)}</span>
                  </div>
                )}
                {pending && (
                  <div className="plan-assign-next flex items-center justify-between gap-3">
                    <span className="plan-assign-label">Plan if accepted</span>
                    <span className="plan-assign-value">
                      {labelForAdminPlanAssignment(pending)}
                    </span>
                  </div>
                )}
              </div>

              <p className="plan-assign-note text-sm leading-relaxed">
                Nothing changes on their account until they open the dashboard inbox and click{" "}
                <strong>Accept</strong>. They can also decline the request.
              </p>
              <div className="plan-assign-identity">
                <AdminUserIdentityBlock
                  name={targetUserName}
                  email={targetUserEmail}
                  userId={targetUserId}
                />
              </div>
            </div>
          </AlertDialogHeader>
          {error && (
            <p className="plan-assign-error text-sm" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              className="h-10 border-2"
              onClick={() => {
                if (!isPending) setError(null);
              }}
              disabled={isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-10 border-2"
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
