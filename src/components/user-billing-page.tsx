"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ManageBillingButton } from "@/components/manage-billing-button";
import { CreditCard, ExternalLink, Zap } from "lucide-react";

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

export function UserBillingPage() {
  const { user } = useUser();
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
    </div>
  );
}
