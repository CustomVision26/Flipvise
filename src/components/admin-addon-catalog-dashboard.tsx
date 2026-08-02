"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { buttonVariants } from "@/components/ui/button-variants";
import { AI_ESSAY_ADDON_KEY, LIVE_CLASSROOM_ADDON_KEY } from "@/lib/addon-keys";
import { AI_ESSAY_STUDIO_BASE } from "@/lib/ai-document-studio-paths";
import { LIVE_CLASSROOM_ROOT_PATH } from "@/lib/live-classroom-url";
import {
  adminSupportChartCardClass,
  adminSupportSectionLabelClass,
  adminSupportTableCardClass,
} from "@/components/admin-panel-styles";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { isPlanEligibleForAddon } from "@/lib/addon-plan-eligibility";
import { cn } from "@/lib/utils";
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ExternalLink,
  Loader2,
  Search,
  Store,
  UserPlus,
} from "lucide-react";

export type AdminAddonCatalogItem = AddonCatalogRow & {
  stripePriceConfigured: boolean;
};

export type AdminAddonAssignableUser = {
  userId: string;
  name: string;
  email: string | null;
  /** Effective base plan slug (`null` / free when unpaid). */
  planSlug: string | null;
  planLabel: string;
};

export type AdminAddonEntitlementRow = {
  id: number;
  userId: string;
  userName: string;
  userEmail: string | null;
  planSlug: string | null;
  planLabel: string;
  addonKey: string;
  addonName: string;
  source: "stripe" | "admin" | "team";
  updatedAt: string;
};

type AdminAddonCatalogDashboardProps = {
  pricingCatalogVisible: boolean;
  items: AdminAddonCatalogItem[];
  users: AdminAddonAssignableUser[];
  /** Active grants across all add-ons; defaults to [] for HMR / partial renders. */
  entitlements?: AdminAddonEntitlementRow[];
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
  users,
  entitlements = [],
}: AdminAddonCatalogDashboardProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [assignUserId, setAssignUserId] = React.useState("");
  const [assignAddonKey, setAssignAddonKey] = React.useState(items[0]?.key ?? "");
  const [userPickerOpen, setUserPickerOpen] = React.useState(false);
  const [userSearch, setUserSearch] = React.useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setSuccess(null);
    setPending(label);
    try {
      await fn();
      const message =
        label === "assign"
          ? "Add-on assigned successfully."
          : label === "revoke"
            ? "Add-on revoked successfully."
            : "Changes saved successfully.";
      setSuccess(message);
      toast.success(message);
      router.refresh();
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Unable to complete this action.";
      setError(message);
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  const selectedAddon = React.useMemo(
    () => items.find((item) => item.key === assignAddonKey) ?? null,
    [items, assignAddonKey],
  );

  const planEligibleUsers = React.useMemo(() => {
    if (!selectedAddon) return users;
    return users.filter((user) =>
      isPlanEligibleForAddon(selectedAddon.eligiblePlanIds, user.planSlug),
    );
  }, [users, selectedAddon]);

  const selectedUser = React.useMemo(
    () =>
      planEligibleUsers.find((user) => user.userId === assignUserId) ?? null,
    [planEligibleUsers, assignUserId],
  );

  React.useEffect(() => {
    if (!assignUserId) return;
    const stillEligible = planEligibleUsers.some(
      (user) => user.userId === assignUserId,
    );
    if (!stillEligible) setAssignUserId("");
  }, [assignUserId, planEligibleUsers]);

  const filteredUsers = React.useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return planEligibleUsers;
    return planEligibleUsers.filter((user) => {
      const haystack =
        `${user.name} ${user.email ?? ""} ${user.planLabel}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [planEligibleUsers, userSearch]);

  const assignDisabled =
    Boolean(pending) || !assignUserId.trim() || !assignAddonKey.trim();

  return (
    <TooltipProvider>
      <div className="space-y-8">
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

        <section className="space-y-3" aria-labelledby="pricing-visibility-heading">
          <div>
            <p className={adminSupportSectionLabelClass}>Public catalog</p>
            <h2
              id="pricing-visibility-heading"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              Pricing visibility
            </h2>
          </div>

          <Card className={cn(adminSupportChartCardClass)}>
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                  <Store className="size-4 text-muted-foreground" aria-hidden />
                </span>
                <div className="space-y-1.5">
                  <CardTitle className="text-sm font-semibold tracking-tight">
                    Show Add-on Catalog on Pricing
                  </CardTitle>
                  <CardDescription className="max-w-xl leading-relaxed">
                    When enabled, Pricing links to{" "}
                    <code className="rounded bg-muted/50 px-1 py-0.5 font-mono text-[11px] text-foreground/80">
                      /pricing/add-ons
                    </code>
                    . When disabled, that route redirects back to Pricing.
                  </CardDescription>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 rounded-lg border border-border/60 bg-background/50 px-3.5 py-2.5">
                <div className="min-w-0 text-right sm:text-left">
                  <Label
                    htmlFor="pricing-addon-visible"
                    className="text-sm font-medium text-foreground"
                  >
                    Catalog status
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {pricingCatalogVisible ? "Visible to customers" : "Hidden from Pricing"}
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
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3" aria-labelledby="catalog-entries-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className={adminSupportSectionLabelClass}>Catalog</p>
              <h2
                id="catalog-entries-heading"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                Catalog entries
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Turn selling and assignment on or off per add-on. Use Published to
                show or hide each add-on in the top header banner, and On pricing
                for the public catalog. Existing entitlements stay until you revoke
                them.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {items.length} {items.length === 1 ? "add-on" : "add-ons"}
            </Badge>
          </div>

          <Card className={cn(adminSupportTableCardClass)}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                      <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Published
                      </TableHead>
                      <TableHead className="pr-5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        On pricing
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-muted-foreground"
                        >
                          No add-ons are registered yet. Seed a catalog row or
                          register a new add-on feature key.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.key} className="align-top">
                          <TableCell className="py-4 pl-5">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">
                                  {item.name}
                                </span>
                                {item.key === AI_ESSAY_ADDON_KEY ? (
                                  <Link
                                    href={AI_ESSAY_STUDIO_BASE}
                                    className={cn(
                                      buttonVariants({
                                        variant: "outline",
                                        size: "sm",
                                      }),
                                      "h-7 gap-1.5 px-2.5 text-xs",
                                    )}
                                  >
                                    Open studio
                                    <ExternalLink
                                      className="size-3 opacity-80"
                                      aria-hidden
                                    />
                                  </Link>
                                ) : null}
                                {item.key === LIVE_CLASSROOM_ADDON_KEY ? (
                                  <Link
                                    href={LIVE_CLASSROOM_ROOT_PATH}
                                    className={cn(
                                      buttonVariants({
                                        variant: "outline",
                                        size: "sm",
                                      }),
                                      "h-7 gap-1.5 px-2.5 text-xs",
                                    )}
                                  >
                                    Open classroom
                                    <ExternalLink
                                      className="size-3 opacity-80"
                                      aria-hidden
                                    />
                                  </Link>
                                ) : null}
                              </div>
                              <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                {item.key}
                              </code>
                              {(item.description || item.marketingBlurb) && (
                                <p className="max-w-md text-xs leading-relaxed text-muted-foreground line-clamp-2">
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
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
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
                                aria-label={`Active ${item.name}`}
                              />
                              <span className="text-[10px] text-muted-foreground">
                                {item.active ? "On" : "Off"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <div className="inline-flex flex-col items-center gap-1">
                              <Switch
                                checked={item.publishedOnBanner}
                                disabled={pending === `banner:${item.key}`}
                                onCheckedChange={(checked) =>
                                  void run(`banner:${item.key}`, () =>
                                    setAddonCatalogFlagsAction({
                                      addonKey: item.key,
                                      publishedOnBanner: checked,
                                    }).then(() => undefined),
                                  )
                                }
                                aria-label={`Publish ${item.name} in header banner`}
                              />
                              <span className="text-[10px] text-muted-foreground">
                                {item.publishedOnBanner ? "In banner" : "Hidden"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 pr-5 text-center">
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
                                aria-label={`Publish ${item.name} on pricing`}
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
        </section>

        <section className="space-y-3" aria-labelledby="active-entitlements-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className={adminSupportSectionLabelClass}>Access grants</p>
              <h2
                id="active-entitlements-heading"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                Active entitlements
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Every user who currently has an add-on via Stripe, platform admin,
                or Team Admin grant.
              </p>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {entitlements.length}{" "}
              {entitlements.length === 1 ? "record" : "records"}
            </Badge>
          </div>

          <Card className={cn(adminSupportTableCardClass)}>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        User
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Add-on
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Base plan
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Source
                      </TableHead>
                      <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Updated
                      </TableHead>
                      <TableHead className="pr-5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entitlements.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="px-5 py-12 text-center text-sm text-muted-foreground"
                        >
                          No active add-on entitlements yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      entitlements.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="py-3 pl-5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {row.userName}
                              </p>
                              {row.userEmail ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {row.userEmail}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium text-foreground">
                                {row.addonName}
                              </p>
                              <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                {row.addonKey}
                              </code>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="secondary" className="font-normal">
                              {row.planLabel || "Unknown"}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge variant="outline" className="capitalize">
                              {row.source}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3 text-sm text-muted-foreground tabular-nums">
                            {new Date(row.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="py-3 pr-5 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={Boolean(pending)}
                                onClick={() => {
                                  setAssignUserId(row.userId);
                                  setAssignAddonKey(row.addonKey);
                                }}
                              >
                                Select
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                                disabled={Boolean(pending)}
                                onClick={() =>
                                  void run(`revoke:${row.id}`, () =>
                                    revokeAddonFromUserAction({
                                      targetUserId: row.userId,
                                      addonKey: row.addonKey,
                                      cancelStripe: true,
                                    }),
                                  )
                                }
                              >
                                {pending === `revoke:${row.id}` ? (
                                  <Loader2
                                    className="size-3.5 animate-spin"
                                    aria-hidden
                                  />
                                ) : (
                                  "Revoke"
                                )}
                              </Button>
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
        </section>

        <section className="space-y-3" aria-labelledby="complimentary-heading">
          <div>
            <p className={adminSupportSectionLabelClass}>Access grants</p>
            <h2
              id="complimentary-heading"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              Complimentary assignment
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Grant or revoke an add-on for a registered user without Stripe
              billing. The user list filters to plans eligible for the selected
              add-on (for example, Live Classroom™ shows Team / Education tiers
              only). Team Admins can also assign member add-ons from Team Admin →
              Add-ons.
            </p>
          </div>

          <Card className={cn(adminSupportChartCardClass)}>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0 border-b border-border/50 pb-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
                <UserPlus className="size-4 text-muted-foreground" aria-hidden />
              </span>
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold tracking-tight">
                  Assign or revoke access
                </CardTitle>
                <CardDescription className="leading-relaxed">
                  Choose an add-on first, then search eligible users by name or
                  email and confirm the action below.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assign-user-picker" className="text-sm font-medium">
                    User
                  </Label>
                  <Popover
                    open={userPickerOpen}
                    onOpenChange={(open) => {
                      setUserPickerOpen(open);
                      if (!open) setUserSearch("");
                    }}
                  >
                    <PopoverTrigger
                      nativeButton
                      render={(props) => (
                        <Button
                          {...props}
                          id="assign-user-picker"
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={userPickerOpen}
                          className={cn(
                            "h-9 w-full justify-between border-input bg-transparent px-2.5 font-normal dark:bg-input/30 dark:hover:bg-input/50",
                            props.className,
                          )}
                        >
                          <span
                            className={cn(
                              "truncate text-left",
                              !selectedUser && "text-muted-foreground",
                            )}
                          >
                            {selectedUser
                              ? selectedUser.email
                                ? `${selectedUser.name} · ${selectedUser.email}`
                                : selectedUser.name
                              : selectedAddon
                                ? "Search eligible users…"
                                : "Search registered users…"}
                          </span>
                          <ChevronsUpDown
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        </Button>
                      )}
                    />
                    <PopoverContent
                      align="start"
                      className="w-[min(100vw-2rem,24rem)] p-2"
                    >
                      <div className="relative mb-2">
                        <Search
                          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                          aria-hidden
                        />
                        <Input
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
                          placeholder="Filter by name or email…"
                          autoComplete="off"
                          className="h-8 pl-8"
                          aria-label="Filter registered users by name"
                        />
                      </div>
                      <div
                        className="max-h-56 overflow-y-auto overscroll-contain"
                        role="listbox"
                        aria-label="Registered users"
                      >
                        {filteredUsers.length === 0 ? (
                          <p className="px-2 py-3 text-sm text-muted-foreground">
                            {planEligibleUsers.length === 0
                              ? "No users on an eligible plan for this add-on."
                              : "No users match that search."}
                          </p>
                        ) : (
                          filteredUsers.map((user) => {
                            const selected = user.userId === assignUserId;
                            return (
                              <button
                                key={user.userId}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={cn(
                                  "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60",
                                  selected && "bg-primary/10",
                                )}
                                onClick={() => {
                                  setAssignUserId(user.userId);
                                  setUserPickerOpen(false);
                                  setUserSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mt-0.5 size-3.5 shrink-0",
                                    selected ? "opacity-100" : "opacity-0",
                                  )}
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium text-foreground">
                                    {user.name}
                                  </span>
                                  {user.email ? (
                                    <span className="block truncate text-xs text-muted-foreground">
                                      {user.email}
                                    </span>
                                  ) : null}
                                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                    {user.planLabel}
                                  </span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assign-addon-key" className="text-sm font-medium">
                    Add-on
                  </Label>
                  {items.length > 0 ? (
                    <Select
                      value={assignAddonKey}
                      onValueChange={(value) => {
                        if (typeof value === "string" && value.trim()) {
                          setAssignAddonKey(value.trim());
                          setUserSearch("");
                        }
                      }}
                    >
                      <SelectTrigger id="assign-addon-key" className="h-9 w-full">
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
                      className="h-9 font-mono text-sm"
                    />
                  )}
                </div>
              </div>

              {selectedUser || selectedAddon ? (
                <div className="rounded-lg border border-border/60 bg-muted/15 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Selection summary
                  </p>
                  <p className="mt-1.5 text-foreground">
                    {selectedUser ? (
                      <>
                        <span className="font-medium">{selectedUser.name}</span>
                        {selectedUser.email ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {selectedUser.email}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">
                          {" "}
                          · {selectedUser.planLabel}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No user selected</span>
                    )}
                    <span className="mx-2 text-muted-foreground">→</span>
                    {selectedAddon ? (
                      <span className="font-medium">{selectedAddon.name}</span>
                    ) : (
                      <span className="text-muted-foreground">No add-on selected</span>
                    )}
                  </p>
                </div>
              ) : null}

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Assign creates a complimentary entitlement. Revoke removes
                  complimentary access and cancels a matching Stripe add-on
                  subscription when present.
                </p>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={assignDisabled || !selectedAddon}
                    onClick={() =>
                      void run("assign", () => {
                        const addonKey = selectedAddon?.key ?? assignAddonKey.trim();
                        if (!assignUserId.trim() || !addonKey) {
                          throw new Error("Select a user and an add-on first.");
                        }
                        return assignAddonToUserAction({
                          targetUserId: assignUserId.trim(),
                          addonKey,
                        });
                      })
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
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}
