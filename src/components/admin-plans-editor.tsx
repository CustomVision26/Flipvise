"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, GripVertical, Save, Check, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PlanConfig, PlanDiscount } from "@/components/pricing-content";
import { updatePlanAction } from "@/actions/admin-plans";

interface AdminPlansEditorProps {
  initialPlans: PlanConfig[];
}

function PlanEditor({
  plan,
  onSaved,
}: {
  plan: PlanConfig;
  onSaved: (updated: PlanConfig) => void;
}) {
  const [draft, setDraft] = useState<PlanConfig>({ ...plan, features: [...plan.features] });
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function update(patch: Partial<PlanConfig>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
    setSaveState("idle");
  }

  function updateFeature(index: number, value: string) {
    const features = [...draft.features];
    features[index] = value;
    update({ features });
  }

  function addFeature() {
    update({ features: [...draft.features, ""] });
  }

  function removeFeature(index: number) {
    const features = draft.features.filter((_, i) => i !== index);
    update({ features });
  }

  function moveFeature(from: number, to: number) {
    if (to < 0 || to >= draft.features.length) return;
    const features = [...draft.features];
    const [moved] = features.splice(from, 1);
    features.splice(to, 0, moved);
    update({ features });
  }

  function handleSave() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await updatePlanAction({ plan: draft });
        setSaveState("success");
        setIsDirty(false);
        onSaved(draft);
        setTimeout(() => setSaveState("idle"), 2000);
      } catch (e) {
        setSaveState("error");
        setErrorMsg(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  function handleReset() {
    setDraft({ ...plan, features: [...plan.features] });
    setIsDirty(false);
    setSaveState("idle");
    setErrorMsg(null);
  }

  const isFree = plan.id === "free";

  return (
    <Card className={isDirty ? "ring-2 ring-primary/40" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">{plan.name}</CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              {plan.id}
            </Badge>
            {isDirty && (
              <Badge variant="secondary" className="text-xs">
                Unsaved
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReset}
                disabled={isPending}
                className="text-xs h-7"
              >
                <X className="size-3 mr-1" />
                Reset
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isPending}
              className="text-xs h-7"
            >
              {isPending ? (
                "Saving…"
              ) : saveState === "success" ? (
                <>
                  <Check className="size-3 mr-1" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="size-3 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
        {errorMsg && (
          <p className="text-xs text-destructive mt-1">{errorMsg}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Name */}
        <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
          <Label className="text-xs text-muted-foreground">Display name</Label>
          <Input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-8 text-sm"
            placeholder="Plan name"
          />
        </div>

        {/* Prices */}
        {!isFree && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Monthly price ($)</Label>
              <Input
                type="number"
                min={0}
                value={draft.monthlyPrice ?? ""}
                onChange={(e) =>
                  update({
                    monthlyPrice: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="h-8 text-sm"
                placeholder="e.g. 15"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Yearly price ($/mo billed annually)</Label>
              <Input
                type="number"
                min={0}
                value={draft.yearlyMonthlyPrice ?? ""}
                onChange={(e) =>
                  update({
                    yearlyMonthlyPrice: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="h-8 text-sm"
                placeholder="e.g. 10"
              />
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Input
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            className="h-8 text-sm"
            placeholder="Short description shown on the pricing card"
          />
        </div>

        {/* Highlighted toggle */}
        {!isFree && (
          <div className="flex items-center gap-3">
            <Switch
              id={`highlighted-${plan.id}`}
              checked={!!draft.highlighted}
              onCheckedChange={(val) => update({ highlighted: val })}
            />
            <Label htmlFor={`highlighted-${plan.id}`} className="text-xs text-muted-foreground cursor-pointer">
              Mark as "Most popular" (highlights the card on the pricing page)
            </Label>
          </div>
        )}

        {/* Discount */}
        {!isFree && (
          <div className="space-y-3 rounded-lg border border-dashed p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Tag className="size-3.5 text-amber-400" />
                <Label className="text-xs font-medium">Discount</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id={`discount-active-${plan.id}`}
                  checked={!!draft.discount?.active}
                  onCheckedChange={(val) =>
                    update({
                      discount: {
                        active: val,
                        type: draft.discount?.type ?? "percentage",
                        value: draft.discount?.value ?? 0,
                        label: draft.discount?.label ?? "",
                        stripeCouponId: draft.discount?.stripeCouponId ?? "",
                      },
                    })
                  }
                />
                <Label htmlFor={`discount-active-${plan.id}`} className="text-xs cursor-pointer">
                  {draft.discount?.active ? (
                    <span className="text-amber-400 font-medium">Active</span>
                  ) : (
                    <span className="text-muted-foreground">Inactive</span>
                  )}
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select
                  value={draft.discount?.type ?? "percentage"}
                  onValueChange={(val: PlanDiscount["type"]) =>
                    update({
                      discount: {
                        active: draft.discount?.active ?? false,
                        type: val,
                        value: draft.discount?.value ?? 0,
                        label: draft.discount?.label ?? "",
                        stripeCouponId: draft.discount?.stripeCouponId ?? "",
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {draft.discount?.type === "fixed" ? "Amount off ($)" : "Percent off (%)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={draft.discount?.type === "percentage" ? 100 : undefined}
                  value={draft.discount?.value ?? 0}
                  onChange={(e) =>
                    update({
                      discount: {
                        active: draft.discount?.active ?? false,
                        type: draft.discount?.type ?? "percentage",
                        value: Number(e.target.value),
                        label: draft.discount?.label ?? "",
                        stripeCouponId: draft.discount?.stripeCouponId ?? "",
                      },
                    })
                  }
                  className="h-8 text-sm"
                  placeholder={draft.discount?.type === "fixed" ? "e.g. 10" : "e.g. 20"}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Promo label{" "}
                <span className="text-muted-foreground/60">(shown as a badge on the pricing card)</span>
              </Label>
              <Input
                value={draft.discount?.label ?? ""}
                onChange={(e) =>
                  update({
                    discount: {
                      active: draft.discount?.active ?? false,
                      type: draft.discount?.type ?? "percentage",
                      value: draft.discount?.value ?? 0,
                      label: e.target.value,
                      stripeCouponId: draft.discount?.stripeCouponId ?? "",
                    },
                  })
                }
                className="h-8 text-sm"
                placeholder="e.g. Launch Special, Summer Sale"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Stripe Coupon ID{" "}
                <span className="text-muted-foreground/60">
                  (from Stripe Dashboard → Coupons — applied to invoices & receipts)
                </span>
              </Label>
              <Input
                value={draft.discount?.stripeCouponId ?? ""}
                onChange={(e) =>
                  update({
                    discount: {
                      active: draft.discount?.active ?? false,
                      type: draft.discount?.type ?? "percentage",
                      value: draft.discount?.value ?? 0,
                      label: draft.discount?.label ?? "",
                      stripeCouponId: e.target.value.trim(),
                    },
                  })
                }
                className="h-8 text-sm font-mono"
                placeholder="e.g. PROMO_LAUNCH25"
              />
            </div>

            {draft.discount?.active && draft.discount.value > 0 && (
              <div className="text-xs text-amber-400 bg-amber-500/10 rounded-md px-3 py-2 border border-amber-500/20">
                Preview: {draft.discount.type === "percentage"
                  ? `${draft.discount.value}% discount`
                  : `$${draft.discount.value} off`}
                {draft.discount.label ? ` — "${draft.discount.label}"` : ""}
                {!draft.discount.stripeCouponId && (
                  <span className="block mt-1 text-amber-400/70">
                    ⚠ No Stripe Coupon ID — discount will display on the pricing page but won't be
                    applied at checkout.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Features */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Features</Label>
          <div className="space-y-1.5">
            {draft.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => moveFeature(index, index - 1)}
                    disabled={index === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                    title="Move up"
                  >
                    ▲
                  </button>
                  <GripVertical className="size-3 text-muted-foreground/50" />
                  <button
                    type="button"
                    onClick={() => moveFeature(index, index + 1)}
                    disabled={index === draft.features.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none"
                    title="Move down"
                  >
                    ▼
                  </button>
                </div>
                <Input
                  value={feature}
                  onChange={(e) => updateFeature(index, e.target.value)}
                  className="h-8 text-sm flex-1"
                  placeholder={`Feature ${index + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeFeature(index)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove feature"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addFeature}
            className="text-xs h-7 mt-1"
          >
            <Plus className="size-3 mr-1" />
            Add feature
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPlansEditor({ initialPlans }: AdminPlansEditorProps) {
  const [plans, setPlans] = useState<PlanConfig[]>(initialPlans);
  const [activeTab, setActiveTab] = useState<string>(initialPlans[0]?.id ?? "");

  function handlePlanSaved(updated: PlanConfig) {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  const activePlan = plans.find((p) => p.id === activeTab) ?? plans[0];

  return (
    <div className="space-y-0">
      {/* Tab row */}
      <div className="flex flex-wrap gap-0 border-b border-border overflow-x-auto">
        {plans.map((plan) => {
          const isActive = plan.id === activeTab;
          const hasDiscount = plan.discount?.active && (plan.discount.value ?? 0) > 0;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setActiveTab(plan.id)}
              className={[
                "relative flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              ].join(" ")}
            >
              {plan.name}
              {hasDiscount && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                  {plan.discount!.type === "percentage"
                    ? `${plan.discount!.value}%`
                    : `$${plan.discount!.value}`}{" "}
                  off
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active plan editor */}
      {activePlan && (
        <div className="pt-4">
          <PlanEditor key={activePlan.id} plan={activePlan} onSaved={handlePlanSaved} />
        </div>
      )}
    </div>
  );
}
