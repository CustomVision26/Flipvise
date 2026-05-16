"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BILLING_SYNCED_EVENT,
} from "@/components/stripe-checkout-toast";
import { loadBillingTabDataAction } from "@/actions/billing-page";
import { isStripePaidPlanId } from "@/lib/billing-plan-ids";
import type { CancelSubscriptionPreview } from "@/lib/stripe-cancel-subscription";
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
import { CancelSubscriptionButton } from "@/components/cancel-subscription-button";
import { ManageBillingButton } from "@/components/manage-billing-button";
import type { PlanHistoryRow } from "@/lib/plan-history-types";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { CreditCard, ExternalLink, Loader2, Zap } from "lucide-react";

/** Canonical in-app pricing page (see `src/app/pricing/page.tsx`). */
const PRICING_PAGE_PATH = "/pricing" as const;

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
  const rootRef = useRef<HTMLDivElement>(null);
  const { user, isLoaded } = useUser();
  const [tabVisible, setTabVisible] = useState(false);
  const [planHistory, setPlanHistory] = useState<PlanHistoryRow[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [canCancelStripe, setCanCancelStripe] = useState(false);
  const [cancelPreview, setCancelPreview] = useState<CancelSubscriptionPreview | null>(
    null,
  );
  const [billingLoading, setBillingLoading] = useState(false);
  const [stripeCurrentPlanSlug, setStripeCurrentPlanSlug] = useState<string | null>(
    null,
  );
  const [stripeBillingStatus, setStripeBillingStatus] = useState<string | null>(
    null,
  );
  const loadedForUserRef = useRef<string | null>(null);

  const loadBillingData = (userId: string, force = false) => {
    if (!force && loadedForUserRef.current === userId) return;

    setBillingLoading(true);
    setHistoryError(null);

    void loadBillingTabDataAction()
      .then((data) => {
        loadedForUserRef.current = userId;
        setPlanHistory(data.planHistory);
        setCanCancelStripe(data.canCancelStripe);
        setCancelPreview(data.cancelPreview);
        setStripeCurrentPlanSlug(data.currentPlanSlug);
        setStripeBillingStatus(data.billingStatus);
        setHistoryError(null);
      })
      .catch((err) => {
        console.error("[UserBillingPage] billing tab:", err);
        setHistoryError("Could not load plan history.");
        setPlanHistory([]);
        setCanCancelStripe(false);
        setCancelPreview(null);
        setStripeCurrentPlanSlug(null);
        setStripeBillingStatus(null);
      })
      .finally(() => {
        setBillingLoading(false);
      });
  };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setTabVisible(true);
        }
      },
      { root: null, threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!tabVisible || !isLoaded || !user?.id) return;
    loadBillingData(user.id);
  }, [tabVisible, isLoaded, user?.id]);

  useEffect(() => {
    const onSynced = () => {
      if (!user?.id) return;
      loadedForUserRef.current = null;
      loadBillingData(user.id, true);
    };
    window.addEventListener(BILLING_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(BILLING_SYNCED_EVENT, onSynced);
  }, [user?.id]);

  const meta = (user?.publicMetadata ?? {}) as Record<string, unknown>;

  const metaBillingStatus = meta.billingStatus as string | undefined;
  const adminPlan = meta.adminPlan as string | undefined;

  const metaPlan = (meta.plan as string | undefined) ?? null;
  const resolvedPlan = stripeCurrentPlanSlug ?? metaPlan;
  const isPaid = !!resolvedPlan;
  const planLabel = resolvedPlan ? displayNameForBillingPlanSlug(resolvedPlan) : "Free";

  const billingStatus = stripeBillingStatus ?? metaBillingStatus;
  const isActive = billingStatus === "active" || billingStatus === "trialing";
  const isAdminGranted = !!adminPlan && resolvedPlan === adminPlan;
  const isPaidStripePlan =
    resolvedPlan != null &&
    resolvedPlan !== "free" &&
    isStripePaidPlanId(resolvedPlan);
  const showPaidStripeControls = isPaidStripePlan && !isAdminGranted;

  return (
    <div ref={rootRef} className="flex flex-col gap-6 p-1 min-h-[120px]">
      <div>
        <h2 className="text-base font-semibold text-foreground">Billing</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your Flipvise subscription and payments.
        </p>
      </div>

      <Separator />

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

      <div className="flex flex-col gap-3">
        {showPaidStripeControls && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              Manage subscription
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Update your payment method, download invoices, or cancel renewal.
              You keep access until the end of the current billing period.
            </p>
            <div className="flex flex-wrap gap-2">
              {canCancelStripe ? (
                <CancelSubscriptionButton
                  preview={cancelPreview}
                  onPreviewChange={setCancelPreview}
                />
              ) : null}
              <ManageBillingButton
                label="Open billing portal"
                variant="outline"
                size="sm"
              />
              <Link
                href={PRICING_PAGE_PATH}
                className={cn(
                  buttonVariants({ variant: "secondary", size: "sm" }),
                  "gap-2",
                )}
              >
                <ExternalLink className="size-3.5" aria-hidden />
                View plans
              </Link>
            </div>
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
              href={PRICING_PAGE_PATH}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "w-fit gap-2",
              )}
            >
              <Zap className="size-3.5" aria-hidden />
              View plans
            </Link>
          </div>
        )}

        {isPaid && !showPaidStripeControls && (
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">
              {isAdminGranted ? "Complimentary access" : "Change or upgrade plan"}
            </p>
            <Link
              href={PRICING_PAGE_PATH}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-fit gap-2",
              )}
            >
              <ExternalLink className="size-3.5" aria-hidden />
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

        {(billingLoading || planHistory === null) && !historyError && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="size-4 animate-spin shrink-0" />
            Loading history…
          </div>
        )}

        {historyError && (
          <p className="text-xs text-destructive">{historyError}</p>
        )}

        {planHistory && planHistory.length === 0 && !historyError && !billingLoading && (
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