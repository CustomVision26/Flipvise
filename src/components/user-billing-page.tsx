"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ManageBillingButton } from "@/components/manage-billing-button";
import { loadUserPlanHistoryAction } from "@/actions/plan-history";
import type { PlanHistoryRow } from "@/lib/plan-history-types";
import { CreditCard, ExternalLink, Loader2, Zap } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  pro: "Pro",
  pro_team_basic: "Team Basic",
  pro_team_gold: "Team Gold",
  pro_platinum_plan: "Platinum",
  pro_enterprise: "Enterprise",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  canceled: "Canceled",
  expired: "Expired",
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function UserBillingPage() {
  const { user, isLoaded } = useUser();
  const [planHistory, setPlanHistory] = useState<PlanHistoryRow[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user?.id) {
      setPlanHistory([]);
      return;
    }

    let cancelled = false;
    setPlanHistory(null);
    setHistoryError(null);
    loadUserPlanHistoryAction()
      .then((rows) => {
        if (!cancelled) setPlanHistory(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setHistoryError("Could not load plan history.");
          setPlanHistory([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user?.id]);
  const meta = (user?.publicMetadata ?? {}) as Record<string, unknown>;

  const billingPlan = meta.billingPlan as string | undefined;
  const billingStatus = meta.billingStatus as string | undefined;
  const adminPlan = meta.adminPlan as string | undefined;

  const resolvedPlan = (meta.plan as string | undefined) ?? null;
  const isPaid = !!resolvedPlan;
  const planLabel = resolvedPlan ? (PLAN_LABELS[resolvedPlan] ?? resolvedPlan) : "Free";

  const isActive = billingStatus === "active" || billingStatus === "trialing";
  const hasStripeSubscription = !!billingPlan && isActive;
  const isAdminGranted = !!adminPlan && resolvedPlan === adminPlan;

  return (
    <div className="flex flex-col gap-6 p-1">
      <div>
        <h2 className="text-base font-semibold text-foreground">Billing</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your Flipvise subscription and payments.
        </p>
      </div>

      <Separator />

      {/* Current plan */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Current plan
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-9 rounded-full bg-muted shrink-0">
            {isPaid ? (
              <Zap className="size-4 text-primary" />
            ) : (
              <CreditCard className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {planLabel}
              </span>
              {billingStatus && (
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {STATUS_LABELS[billingStatus] ?? billingStatus}
                </Badge>
              )}
              {isAdminGranted && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  Complimentary
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {isPaid ? "Paid subscription" : "No active subscription"}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {hasStripeSubscription && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              Manage subscription
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Update payment method, download invoices, or cancel your plan via
              the Stripe Customer Portal.
            </p>
            <ManageBillingButton
              label="Open billing portal"
              variant="outline"
              size="sm"
            />
          </div>
        )}

        {!isPaid && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              Upgrade your plan
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Unlock AI flashcard generation, custom themes, and more.
            </p>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "w-fit gap-2",
              )}
            >
              <Zap className="size-3.5" />
              View plans
            </Link>
          </div>
        )}

        {isPaid && !hasStripeSubscription && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              Change or upgrade plan
            </p>
            <Link
              href="/pricing"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-fit gap-2",
              )}
            >
              <ExternalLink className="size-3.5" />
              View plans
            </Link>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Plan history
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Paid subscriptions, complimentary access, and affiliate grants linked
            to your account.
          </p>
        </div>

        {planHistory === null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="size-4 animate-spin shrink-0" />
            Loading history…
          </div>
        )}

        {historyError && (
          <p className="text-xs text-destructive">{historyError}</p>
        )}

        {planHistory && planHistory.length === 0 && !historyError && (
          <p className="text-sm text-muted-foreground py-2">
            No plan history recorded yet.
          </p>
        )}

        {planHistory && planHistory.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Plan</TableHead>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap min-w-[140px]">
                  Started
                </TableHead>
                <TableHead className="whitespace-nowrap min-w-[140px]">
                  Ended
                </TableHead>
                <TableHead className="whitespace-nowrap text-right w-[1%]">
                  Receipt
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {planHistory.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium max-w-[200px]">
                    {row.planName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.planType}
                  </TableCell>
                  <TableCell>{row.statusLabel}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {formatDateTime(row.startAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {row.endAt ? formatDateTime(row.endAt) : "Ongoing"}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.receiptUrl ? (
                      <a
                        href={row.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "link", size: "sm" }),
                          "inline-flex items-center gap-1 h-auto min-h-0 py-0 px-0 font-normal",
                        )}
                      >
                        View
                        <ExternalLink className="size-3.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
