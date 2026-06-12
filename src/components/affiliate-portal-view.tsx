"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  BadgePercent,
  CalendarRange,
  Check,
  Copy,
  ExternalLink,
  Megaphone,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AffiliateCombinedPromoRow } from "@/lib/affiliate-portal-combined-codes";
import { cn } from "@/lib/utils";

export type AffiliatePortalViewData = {
  affiliateName: string;
  promotionalCodeSuffix: string;
  planAssignedLabel: string;
  startedAtLabel: string;
  endsAtLabel: string;
  paidReferralsTotal: number;
  paidReferralsThisMonth: number;
  monthLabel: string;
  combinedPromos: AffiliateCombinedPromoRow[];
  referralQuotaEnabled?: boolean;
  periodPaidReferrals?: number;
  referralQuotaTarget?: number | null;
};

function formatValidThrough(isoDate: string | null): string {
  if (!isoDate) return "Open — no tier end date set";
  return new Date(`${isoDate}T23:59:59`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CopyCodeButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [value]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
      onClick={onCopy}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-400" aria-hidden />
      ) : (
        <Copy className="size-3.5" aria-hidden />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

const shellClass =
  "border-2 border-border/70 bg-card/85 shadow-md backdrop-blur-sm";
const sectionLabelClass =
  "text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground";
const kpiCardClass =
  "border-2 border-border/70 bg-background/50 shadow-sm transition-colors hover:border-primary/30 hover:bg-background/80";

export function AffiliatePortalView({ data }: { data: AffiliatePortalViewData }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-9 items-center justify-center rounded-lg border-2 border-violet-500/30 bg-violet-500/10">
              <Megaphone className="size-4 text-violet-300" aria-hidden />
            </span>
            <p className={sectionLabelClass}>Affiliate program</p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Welcome, {data.affiliateName}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Track paid subscriptions attributed to your codes, copy checkout
            promotion strings, and review your complimentary plan period.
          </p>
        </div>
        <Link
          href="/pricing"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex h-9 shrink-0 items-center gap-2 border-border/70",
          )}
        >
          <ExternalLink className="size-3.5" aria-hidden />
          View pricing page
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={kpiCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total paid subscriptions
            </CardTitle>
            <Users className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {data.paidReferralsTotal}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Users who subscribed with your combined codes
            </p>
          </CardContent>
        </Card>
        <Card className={kpiCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This month
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {data.paidReferralsThisMonth}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Paid referrals in {data.monthLabel}
            </p>
          </CardContent>
        </Card>
        <Card className={kpiCardClass}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your plan grant
            </CardTitle>
            <BadgePercent className="size-4 text-muted-foreground" aria-hidden />
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{data.planAssignedLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Complimentary access while your arrangement is active
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className={shellClass}>
        <CardHeader className="border-b border-border/50 pb-4">
          <p className={sectionLabelClass}>Arrangement</p>
          <CardTitle className="text-lg font-semibold tracking-tight">
            Plan period
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className="mt-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              Active
            </Badge>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="size-3.5" aria-hidden />
              Started
            </p>
            <p className="mt-2 text-sm font-medium">{data.startedAtLabel}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarRange className="size-3.5" aria-hidden />
              Ends
            </p>
            <p className="mt-2 text-sm font-medium">{data.endsAtLabel}</p>
          </div>
          {data.referralQuotaEnabled && data.referralQuotaTarget != null ? (
            <div className="rounded-lg border border-border/60 bg-background/40 p-4 sm:col-span-3">
              <p className="text-xs text-muted-foreground">Period referral quota</p>
              <p className="mt-2 text-sm font-medium tabular-nums">
                {data.periodPaidReferrals ?? 0}{" "}
                <span className="text-muted-foreground">
                  / {data.referralQuotaTarget} paid subscriptions
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Meet this quota before your period ends to automatically renew your
                complimentary plan for the next period.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className={shellClass}>
        <CardHeader className="border-b border-border/50 pb-4">
          <p className={sectionLabelClass}>Promotion codes</p>
          <CardTitle className="text-lg font-semibold tracking-tight">
            Checkout codes to share
          </CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your affiliate suffix is{" "}
            <span className="font-mono text-foreground">
              {data.promotionalCodeSuffix}
            </span>
            . Customers enter the combined code on the{" "}
            <Link href="/pricing" className="text-primary underline-offset-4 hover:underline">
              pricing page
            </Link>{" "}
            before subscribing. The discount applies to the plan they choose.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {data.combinedPromos.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">
              No affiliate checkout tiers are configured right now. Contact
              support if you expected promotion codes here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Combined code</TableHead>
                    <TableHead className="whitespace-nowrap">
                      Affiliate discount
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      Valid through
                    </TableHead>
                    <TableHead className="w-[5.5rem] text-right">
                      Copy
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.combinedPromos.map((row) => (
                    <TableRow key={row.planId}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {row.planName}
                      </TableCell>
                      <TableCell>
                        <code className="rounded-md border border-border/60 bg-muted/30 px-2 py-1 font-mono text-xs">
                          {row.combinedCode}
                        </code>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.affiliatePercent}% off
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatValidThrough(row.validThrough)}
                      </TableCell>
                      <TableCell className="text-right">
                        <CopyCodeButton value={row.combinedCode} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cn(shellClass, "border-dashed")}>
        <CardContent className="space-y-2 py-6 text-sm leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">How attribution works</p>
          <p>
            When someone completes checkout with your combined code, Flipvise
            records a paid referral on your account. Totals update after
            successful Stripe subscription checkout.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
