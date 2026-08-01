"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelBillingRenewalsAction,
  getCancelSubscriptionPreviewAction,
  resumePlanRenewalAction,
} from "@/actions/stripe";
import { resumeOwnAddonRenewalsAction } from "@/actions/addons";
import type { BillingCancelAddonOption } from "@/actions/billing-page";
import type { CancelSubscriptionPreview } from "@/lib/stripe-cancel-subscription";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatPeriodEnd(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type CancelScope = "addons" | "plan" | "both";

type CancelSubscriptionButtonProps = {
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
  className?: string;
  /** When provided by the billing tab loader, avoids a separate server action on mount. */
  preview?: CancelSubscriptionPreview | null;
  onPreviewChange?: (preview: CancelSubscriptionPreview | null) => void;
  /** Active Stripe-billed add-ons; when present, cancel opens a choice dialog. */
  cancelableAddons?: BillingCancelAddonOption[];
  onCancelableAddonsChange?: (addons: BillingCancelAddonOption[]) => void;
};

export function CancelSubscriptionButton({
  variant = "outline",
  size = "sm",
  className,
  preview: previewProp = null,
  onPreviewChange,
  cancelableAddons: addonsProp = [],
  onCancelableAddonsChange,
}: CancelSubscriptionButtonProps) {
  const router = useRouter();
  const [previewLocal, setPreviewLocal] = useState<CancelSubscriptionPreview | null>(
    previewProp,
  );
  const [addonsLocal, setAddonsLocal] =
    useState<BillingCancelAddonOption[]>(addonsProp);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [scope, setScope] = useState<CancelScope>("addons");
  const [selectedAddonKeys, setSelectedAddonKeys] = useState<string[]>([]);
  /** Add-ons already canceling that the user wants to resume auto-renewal for. */
  const [resumeAddonKeys, setResumeAddonKeys] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const preview = previewProp ?? previewLocal;
  const cancelableAddons = addonsProp.length > 0 ? addonsProp : addonsLocal;
  const renewingAddons = cancelableAddons.filter(
    (addon) => !addon.cancelAtPeriodEnd,
  );
  const cancelingAddons = cancelableAddons.filter(
    (addon) => addon.cancelAtPeriodEnd,
  );
  const hasRenewingAddons = renewingAddons.length > 0;

  useEffect(() => {
    setPreviewLocal(previewProp);
  }, [previewProp]);

  useEffect(() => {
    setAddonsLocal(addonsProp);
  }, [addonsProp]);

  const loadPreview = useCallback(async () => {
    setPreviewError(null);
    try {
      const data = await getCancelSubscriptionPreviewAction();
      setPreviewLocal(data);
      onPreviewChange?.(data);
      return data;
    } catch (err) {
      setPreviewLocal(null);
      onPreviewChange?.(null);
      const message =
        err instanceof Error ? err.message : "Could not load subscription.";
      setPreviewError(message);
      return null;
    }
  }, [onPreviewChange]);

  function openChoiceDialog() {
    setSelectedAddonKeys(renewingAddons.map((addon) => addon.addonKey));
    setResumeAddonKeys([]);
    setScope(hasRenewingAddons ? "addons" : "plan");
    setDialogOpen(true);
  }

  function runResumeAddons(keys: string[]) {
    if (keys.length === 0) return;
    startTransition(async () => {
      try {
        const result = await resumeOwnAddonRenewalsAction({ addonKeys: keys });
        const names = result.resumedAddonKeys
          .map(
            (key) =>
              cancelableAddons.find((addon) => addon.addonKey === key)?.label ??
              key,
          )
          .join(", ");
        toast.success("Add-on auto-renewal resumed", {
          description: `${names} will renew again after ${formatPeriodEnd(result.periodEndIso)}.`,
        });
        setDialogOpen(false);
        router.refresh();
        await loadPreview();
        onCancelableAddonsChange?.(
          cancelableAddons.map((addon) =>
            result.resumedAddonKeys.includes(addon.addonKey)
              ? { ...addon, cancelAtPeriodEnd: false }
              : addon,
          ),
        );
      } catch (err) {
        toast.error("Could not resume add-on renewal", {
          description:
            err instanceof Error ? err.message : "Please try again.",
        });
      }
    });
  }

  function runResumePlan() {
    startTransition(async () => {
      try {
        const result = await resumePlanRenewalAction();
        toast.success("Plan renewal resumed", {
          description: `Your ${preview?.planLabel ?? "plan"} will keep renewing. Next period continues past ${formatPeriodEnd(result.periodEnd)}.`,
        });
        router.refresh();
        await loadPreview();
      } catch (err) {
        toast.error("Could not resume plan renewal", {
          description:
            err instanceof Error ? err.message : "Please try again.",
        });
      }
    });
  }

  function runScopedCancel(previewData: CancelSubscriptionPreview) {
    const effectiveScope: CancelScope = hasRenewingAddons ? scope : "plan";
    const addonKeys =
      effectiveScope === "plan"
        ? renewingAddons.map((addon) => addon.addonKey)
        : selectedAddonKeys;

    if (effectiveScope === "addons" && addonKeys.length === 0) {
      toast.error("Select an add-on", {
        description: "Choose at least one add-on renewal to end.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await cancelBillingRenewalsAction({
          scope: effectiveScope,
          addonKeys: effectiveScope === "plan" ? undefined : addonKeys,
        });

        const parts: string[] = [];
        if (result.canceledPlan) {
          parts.push(
            `${previewData.planLabel} renewal stops after ${formatPeriodEnd(result.periodEnd)}`,
          );
        } else if (result.canceledAddonKeys.length > 0) {
          parts.push(
            `${previewData.planLabel} keeps renewing on its normal schedule`,
          );
        }
        if (result.canceledAddonKeys.length > 0) {
          const names = result.canceledAddonKeys
            .map(
              (key) =>
                cancelableAddons.find((addon) => addon.addonKey === key)
                  ?.label ?? key,
            )
            .join(", ");
          parts.push(
            `${names} add-on renewal ends after the current period (check Inbox for confirmation)`,
          );
        }

        toast.success("Renewal cancellation scheduled", {
          description: parts.join(". ") + ".",
        });

        setDialogOpen(false);
        router.refresh();
        await loadPreview();
        onCancelableAddonsChange?.(
          cancelableAddons.map((addon) =>
            result.canceledAddonKeys.includes(addon.addonKey) ||
            result.canceledPlan
              ? { ...addon, cancelAtPeriodEnd: true }
              : addon,
          ),
        );
      } catch (err) {
        toast.error("Could not cancel renewal", {
          description:
            err instanceof Error ? err.message : "Please try again.",
        });
      }
    });
  }

  async function handleClick() {
    let activePreview = preview;
    if (!activePreview) {
      activePreview = await loadPreview();
    }
    if (!activePreview) {
      toast.error("Subscription unavailable", {
        description: previewError ?? "Try again in a moment.",
      });
      return;
    }

    if (activePreview.cancelAtPeriodEnd && !hasRenewingAddons) {
      toast.info("Cancellation already scheduled", {
        description: `Your plan stays active until ${formatPeriodEnd(activePreview.periodEnd)}. No further renewals will be charged.`,
      });
      return;
    }

    openChoiceDialog();
  }

  if (previewError && !preview) {
    if (/no active paid subscription/i.test(previewError)) {
      return null;
    }
    return <p className="text-xs text-destructive">{previewError}</p>;
  }

  if (preview?.cancelAtPeriodEnd) {
    return (
      <div className="flex flex-col gap-2 w-full max-w-lg">
        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          Plan renewal canceled — access until{" "}
          <span className="text-foreground font-medium">
            {formatPeriodEnd(preview.periodEnd)}
          </span>
          .
          {cancelingAddons.length > 0
            ? " Add-on renewals are also scheduled to end."
            : ""}
        </div>
        <Button
          type="button"
          variant="outline"
          size={size}
          disabled={isPending}
          onClick={() => runResumePlan()}
          className={cn("w-fit", className)}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing…
            </>
          ) : (
            "Keep renewing plan"
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2 w-full max-w-lg">
        {cancelingAddons.length > 0 ? (
          <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-2">
            <p>
              <span className="text-foreground font-medium">
                {cancelingAddons.map((a) => a.label).join(", ")}
              </span>{" "}
              add-on renewal canceled — access until{" "}
              <span className="text-foreground font-medium">
                {formatPeriodEnd(
                  cancelingAddons[0]?.periodEnd ?? preview?.periodEnd ?? "",
                )}
              </span>
              .
            </p>
            <p>
              Your{" "}
              <span className="text-foreground font-medium">
                {preview?.planLabel ?? "plan"}
              </span>{" "}
              still renews.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isPending}
              onClick={() =>
                runResumeAddons(cancelingAddons.map((a) => a.addonKey))
              }
              className="w-fit"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing…
                </>
              ) : (
                `Resume ${cancelingAddons.length === 1 ? cancelingAddons[0]!.label : "add-on"} auto-renewal`
              )}
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={isPending}
          onClick={() => void handleClick()}
          className={cn("w-fit", className)}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing…
            </>
          ) : (
            "Cancel subscription"
          )}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent nestedModal className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasRenewingAddons ? "End renewal" : "Cancel plan renewal?"}
            </DialogTitle>
            <DialogDescription>
              {hasRenewingAddons
                ? "Choose whether to stop renewing your add-on(s), your active plan, or both. Access continues until the end of the current billing period."
                : `Your ${preview?.planLabel ?? "plan"} stays active until ${preview?.periodEnd ? formatPeriodEnd(preview.periodEnd) : "period end"}. After that, renewal stops and you return to Free.`}
            </DialogDescription>
          </DialogHeader>

          {cancelingAddons.length > 0 && hasRenewingAddons ? (
            <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 space-y-2">
              <p className="text-xs text-muted-foreground">
                Already ending:{" "}
                {cancelingAddons.map((a) => a.label).join(", ")}
                {cancelingAddons[0]?.periodEnd
                  ? ` (until ${formatPeriodEnd(cancelingAddons[0].periodEnd)})`
                  : ""}
                . Resume auto-renewal if you want to keep them?
              </p>
              <div className="grid gap-2">
                {cancelingAddons.map((addon) => {
                  const checked = resumeAddonKeys.includes(addon.addonKey);
                  return (
                    <div
                      key={`resume-mixed-${addon.addonKey}`}
                      className="flex items-center gap-2"
                    >
                      <Checkbox
                        id={`resume-mixed-addon-${addon.addonKey}`}
                        checked={checked}
                        onCheckedChange={(next) => {
                          const isChecked = next === true;
                          setResumeAddonKeys((prev) => {
                            if (isChecked) {
                              return prev.includes(addon.addonKey)
                                ? prev
                                : [...prev, addon.addonKey];
                            }
                            return prev.filter(
                              (key) => key !== addon.addonKey,
                            );
                          });
                        }}
                      />
                      <Label
                        htmlFor={`resume-mixed-addon-${addon.addonKey}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Resume auto-renewal for {addon.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
              {resumeAddonKeys.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  className="w-fit"
                  onClick={() => runResumeAddons(resumeAddonKeys)}
                >
                  Resume selected add-on
                  {resumeAddonKeys.length === 1 ? "" : "s"}
                </Button>
              ) : null}
            </div>
          ) : null}

          {hasRenewingAddons ? (
            <RadioGroup
              value={scope}
              onValueChange={(value) => {
                const next = value ?? "addons";
                if (next === "addons" || next === "plan" || next === "both") {
                  setScope(next);
                  if (next === "both" || next === "addons") {
                    setSelectedAddonKeys(
                      renewingAddons.map((addon) => addon.addonKey),
                    );
                  }
                }
              }}
              className="grid gap-3"
            >
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                  scope === "addons" && "border-primary bg-muted/40",
                )}
              >
                <RadioGroupItem value="addons" className="mt-0.5" />
                <div className="grid gap-2 flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    Active add-on{renewingAddons.length === 1 ? "" : "s"} only
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Keep your {preview?.planLabel ?? "plan"}. Stop selected
                    add-on renewals.
                  </span>
                  {(scope === "addons" || scope === "both") && (
                    <div className="grid gap-2 pt-1">
                      {renewingAddons.map((addon) => {
                        const checked = selectedAddonKeys.includes(
                          addon.addonKey,
                        );
                        return (
                          <div
                            key={addon.addonKey}
                            className="flex items-center gap-2"
                          >
                            <Checkbox
                              id={`cancel-addon-${addon.addonKey}`}
                              checked={checked}
                              disabled={scope === "both"}
                              onCheckedChange={(next) => {
                                const isChecked = next === true;
                                setSelectedAddonKeys((prev) => {
                                  if (isChecked) {
                                    return prev.includes(addon.addonKey)
                                      ? prev
                                      : [...prev, addon.addonKey];
                                  }
                                  return prev.filter(
                                    (key) => key !== addon.addonKey,
                                  );
                                });
                              }}
                            />
                            <Label
                              htmlFor={`cancel-addon-${addon.addonKey}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {addon.label}
                              {addon.periodEnd
                                ? ` — until ${formatPeriodEnd(addon.periodEnd)}`
                                : ""}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                  scope === "plan" && "border-primary bg-muted/40",
                )}
              >
                <RadioGroupItem value="plan" className="mt-0.5" />
                <div className="grid gap-1 flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    Active plan ({preview?.planLabel ?? "Paid plan"})
                    {preview?.periodEnd
                      ? ` — until ${formatPeriodEnd(preview.periodEnd)}`
                      : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Stop plan renewal. Remaining add-ons also stop renewing
                    because they require a paid plan.
                  </span>
                </div>
              </label>

              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                  scope === "both" && "border-primary bg-muted/40",
                )}
              >
                <RadioGroupItem value="both" className="mt-0.5" />
                <div className="grid gap-1 flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    Plan and add-on{renewingAddons.length === 1 ? "" : "s"}
                    {preview?.periodEnd
                      ? ` — until ${formatPeriodEnd(preview.periodEnd)}`
                      : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    End renewal for your {preview?.planLabel ?? "plan"} and all
                    active Stripe add-ons that are still renewing.
                  </span>
                </div>
              </label>
            </RadioGroup>
          ) : (
            <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-3 text-sm space-y-3">
              <p className="font-medium text-foreground">
                {preview?.planLabel ?? "Paid plan"}
                {preview?.periodEnd
                  ? ` — until ${formatPeriodEnd(preview.periodEnd)}`
                  : ""}
              </p>
              {cancelingAddons.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {cancelingAddons.length === 1
                      ? `${cancelingAddons[0]!.label} add-on renewal is already scheduled to end. Resume auto-renewal if you want to keep it?`
                      : "These add-on renewals are already scheduled to end. Resume auto-renewal for any you want to keep?"}
                  </p>
                  <div className="grid gap-2">
                    {cancelingAddons.map((addon) => {
                      const checked = resumeAddonKeys.includes(addon.addonKey);
                      return (
                        <div
                          key={addon.addonKey}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            id={`resume-addon-${addon.addonKey}`}
                            checked={checked}
                            onCheckedChange={(next) => {
                              const isChecked = next === true;
                              setResumeAddonKeys((prev) => {
                                if (isChecked) {
                                  return prev.includes(addon.addonKey)
                                    ? prev
                                    : [...prev, addon.addonKey];
                                }
                                return prev.filter(
                                  (key) => key !== addon.addonKey,
                                );
                              });
                            }}
                          />
                          <Label
                            htmlFor={`resume-addon-${addon.addonKey}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            Resume auto-renewal for {addon.label}
                            {addon.periodEnd
                              ? ` (currently until ${formatPeriodEnd(addon.periodEnd)})`
                              : ""}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDialogOpen(false)}
            >
              Keep renewing
            </Button>
            {!hasRenewingAddons && resumeAddonKeys.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => runResumeAddons(resumeAddonKeys)}
              >
                Resume add-on renewal
              </Button>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !preview}
              onClick={() => {
                if (preview) runScopedCancel(preview);
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Processing…
                </>
              ) : hasRenewingAddons ? (
                "End renewal"
              ) : (
                "End plan renewal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
