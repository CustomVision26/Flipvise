"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  assignAddonToUserAction,
  revokeAddonFromUserAction,
  setAddonCatalogFlagsAction,
  setPricingAddonCatalogVisibleAction,
} from "@/actions/addons";
import type { AddonCatalogRow } from "@/db/queries/addons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export type AdminAddonCatalogItem = AddonCatalogRow & {
  stripePriceConfigured: boolean;
};

type AdminAddonCatalogDashboardProps = {
  pricingCatalogVisible: boolean;
  items: AdminAddonCatalogItem[];
};

function planLabel(slug: string): string {
  try {
    return displayNameForBillingPlanSlug(slug);
  } catch {
    return slug;
  }
}

export function AdminAddonCatalogDashboard({
  pricingCatalogVisible,
  items,
}: AdminAddonCatalogDashboardProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [assignUserId, setAssignUserId] = React.useState("");
  const [assignAddonKey, setAssignAddonKey] = React.useState(items[0]?.key ?? "");

  async function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setSuccess(null);
    setPending(label);
    try {
      await fn();
      setSuccess("Changes saved successfully.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to complete this action.");
    } finally {
      setPending(null);
    }
  }

  const assignDisabled =
    Boolean(pending) || !assignUserId.trim() || !assignAddonKey.trim();

  return (
    <TooltipProvider>
      <div className="space-y-5">
        {(success || error) && (
          <Alert variant={error ? "destructive" : "default"}>
            {error ? (
              <AlertCircle className="size-4" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden />
            )}
            <AlertTitle>{error ? "Action failed" : "Saved"}</AlertTitle>
            <AlertDescription>{error ?? success}</AlertDescription>
          </Alert>
        )}

        <Card className="border-border/70 bg-card/60 shadow-none">
          <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base font-semibold tracking-tight">
                Pricing visibility
              </CardTitle>
              <CardDescription className="max-w-xl leading-relaxed">
                When enabled, Pricing links to the public Add-on Catalog at{" "}
                <span className="font-mono text-xs text-foreground/80">
                  /pricing/add-ons
                </span>
                . When disabled, that route redirects to Pricing.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <div className="min-w-0">
                <Label
                  htmlFor="pricing-addon-visible"
                  className="text-sm font-medium text-foreground"
                >
                  Show catalog on Pricing
                </Label>
                <p className="text-xs text-muted-foreground">
                  {pricingCatalogVisible ? "Currently visible" : "Currently hidden"}
                </p>
              </div>
              <Switch
                id="pricing-addon-visible"
                checked={pricingCatalogVisible}
                disabled={pending === "visibility"}
                onCheckedChange={(checked) =>
                  void run("visibility", () =>
                    setPricingAddonCatalogVisibleAction({ visible: checked }),
                  )
                }
              />
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/70 bg-card/60 shadow-none">
          <CardHeader className="space-y-1.5 border-b border-border/50 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight">
                Catalog entries
              </CardTitle>
              <Badge variant="secondary" className="tabular-nums">
                {items.length} {items.length === 1 ? "add-on" : "add-ons"}
              </Badge>
            </div>
            <CardDescription className="leading-relaxed">
              Activate selling and assignment per add-on, and choose which entries
              appear on the public catalog. Existing entitlements remain until
              revoked.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Feature
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Eligible plans
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Stripe
                    </TableHead>
                    <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Active
                    </TableHead>
                    <TableHead className="pr-6 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      On pricing
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-muted-foreground"
                      >
                        No add-ons are registered. Seed a catalog row or register a
                        new Add-on Feature key.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.key} className="align-top">
                        <TableCell className="pl-6 py-4">
                          <div className="space-y-1.5">
                            <div className="font-medium text-foreground">
                              {item.name}
                            </div>
                            <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                              {item.key}
                            </code>
                            {(item.description || item.marketingBlurb) && (
                              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                {item.description || item.marketingBlurb}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex max-w-[16rem] flex-wrap gap-1">
                            {item.eligiblePlanIds.length > 0 ? (
                              item.eligiblePlanIds.map((slug) => (
                                <Badge
                                  key={slug}
                                  variant="outline"
                                  className="px-1.5 py-0 text-[10px] font-normal"
                                >
                                  {planLabel(slug)}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Tooltip>
                            <TooltipTrigger
                              render={<span className="inline-flex" />}
                            >
                              <Badge
                                variant={
                                  item.stripePriceConfigured
                                    ? "secondary"
                                    : "outline"
                                }
                                className={
                                  item.stripePriceConfigured
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                                    : "border-amber-500/30 text-amber-400"
                                }
                              >
                                {item.stripePriceConfigured
                                  ? "Configured"
                                  : "Env missing"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs font-mono text-xs">
                              {item.stripePriceEnvKey ||
                                "No Stripe price environment key"}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="py-4 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <Switch
                              checked={item.active}
                              disabled={pending === `active:${item.key}`}
                              onCheckedChange={(checked) =>
                                void run(`active:${item.key}`, () =>
                                  setAddonCatalogFlagsAction({
                                    addonKey: item.key,
                                    active: checked,
                                  }).then(() => undefined),
                                )
                              }
                              aria-label={`Active ${item.key}`}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {item.active ? "On" : "Off"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="pr-6 py-4 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <Switch
                              checked={item.publishedOnPricing}
                              disabled={pending === `pub:${item.key}`}
                              onCheckedChange={(checked) =>
                                void run(`pub:${item.key}`, () =>
                                  setAddonCatalogFlagsAction({
                                    addonKey: item.key,
                                    publishedOnPricing: checked,
                                  }).then(() => undefined),
                                )
                              }
                              aria-label={`Publish ${item.key}`}
                            />
                            <span className="text-[10px] text-muted-foreground">
                              {item.publishedOnPricing ? "Listed" : "Hidden"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/60 shadow-none">
          <CardHeader className="space-y-1.5 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold tracking-tight">
              Complimentary assignment
            </CardTitle>
            <CardDescription className="leading-relaxed">
              Grant or revoke an add-on for a Clerk user without Stripe billing.
              The account&apos;s effective plan must be among the add-on&apos;s
              eligible plans.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="assign-user-id" className="text-sm font-medium">
                  Clerk user ID
                </Label>
                <Input
                  id="assign-user-id"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  placeholder="user_…"
                  autoComplete="off"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assign-addon-key" className="text-sm font-medium">
                  Add-on
                </Label>
                {items.length > 0 ? (
                  <Select
                    value={assignAddonKey}
                    onValueChange={(value) => {
                      if (value) setAssignAddonKey(value);
                    }}
                  >
                    <SelectTrigger id="assign-addon-key" className="w-full">
                      <SelectValue placeholder="Select an add-on" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.key} value={item.key}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="assign-addon-key"
                    value={assignAddonKey}
                    onChange={(e) => setAssignAddonKey(e.target.value)}
                    placeholder="study_mode_focus"
                    autoComplete="off"
                    className="font-mono text-sm"
                  />
                )}
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={assignDisabled}
                onClick={() =>
                  void run("assign", () =>
                    assignAddonToUserAction({
                      targetUserId: assignUserId.trim(),
                      addonKey: assignAddonKey.trim(),
                    }),
                  )
                }
              >
                {pending === "assign" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Assign add-on"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={assignDisabled}
                onClick={() =>
                  void run("revoke", () =>
                    revokeAddonFromUserAction({
                      targetUserId: assignUserId.trim(),
                      addonKey: assignAddonKey.trim(),
                      cancelStripe: true,
                    }),
                  )
                }
              >
                {pending === "revoke" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Revoke add-on"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
