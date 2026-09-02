"use client";

import { useState, useTransition } from "react";
import { Save, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { updateAddonPlanAction } from "@/actions/addons";
import type { AdminAddonPlanEditorItem } from "@/lib/admin/load-addon-plan-editor-items";
import { roundMajor } from "@/lib/money-math";

type Draft = {
  name: string;
  description: string;
  marketingBlurb: string;
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
};

function AddonPlanEditor({
  item,
  onSaved,
}: {
  item: AdminAddonPlanEditorItem;
  onSaved: (updated: AdminAddonPlanEditorItem) => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    name: item.name,
    description: item.description,
    marketingBlurb: item.marketingBlurb,
    monthlyPrice: item.monthlyPrice,
    yearlyMonthlyPrice: item.yearlyMonthlyPrice,
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function update(patch: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setIsDirty(true);
    setSaveState("idle");
  }

  function handleSave() {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const saved = await updateAddonPlanAction({
          key: item.key,
          name: draft.name,
          description: draft.description,
          marketingBlurb: draft.marketingBlurb,
          monthlyPrice: draft.monthlyPrice,
          yearlyMonthlyPrice: draft.yearlyMonthlyPrice,
        });
        setSaveState("success");
        setIsDirty(false);
        onSaved({
          ...item,
          name: saved.name,
          description: saved.description,
          marketingBlurb: saved.marketingBlurb,
          monthlyPrice: saved.monthlyPrice,
          yearlyMonthlyPrice: saved.yearlyMonthlyPrice,
        });
        setTimeout(() => setSaveState("idle"), 2000);
      } catch (e) {
        setSaveState("error");
        setErrorMsg(e instanceof Error ? e.message : "Failed to save.");
      }
    });
  }

  function handleReset() {
    setDraft({
      name: item.name,
      description: item.description,
      marketingBlurb: item.marketingBlurb,
      monthlyPrice: item.monthlyPrice,
      yearlyMonthlyPrice: item.yearlyMonthlyPrice,
    });
    setIsDirty(false);
    setSaveState("idle");
    setErrorMsg(null);
  }

  const yearlyTotal =
    draft.yearlyMonthlyPrice != null && draft.yearlyMonthlyPrice > 0
      ? roundMajor(draft.yearlyMonthlyPrice * 12)
      : null;

  return (
    <Card className={isDirty ? "ring-2 ring-primary/40" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">{item.name}</CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              {item.key}
            </Badge>
            {isDirty ? (
              <Badge variant="secondary" className="text-xs">
                Unsaved
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isDirty ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReset}
                disabled={isPending}
                className="h-7 text-xs"
              >
                <X className="mr-1 size-3" />
                Reset
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isPending}
              className="h-7 text-xs"
            >
              {isPending ? (
                "Saving…"
              ) : saveState === "success" ? (
                <>
                  <Check className="mr-1 size-3" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="mr-1 size-3" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
        {errorMsg ? (
          <p className="mt-1 text-xs text-destructive">{errorMsg}</p>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-[6rem_1fr] items-center gap-3">
          <Label className="text-xs text-muted-foreground">Display name</Label>
          <Input
            value={draft.name}
            onChange={(e) => update({ name: e.target.value })}
            className="h-8 text-sm"
            placeholder="Add-on name"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Monthly price ($)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.monthlyPrice ?? ""}
              onChange={(e) =>
                update({
                  monthlyPrice: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="h-8 text-sm"
              placeholder="e.g. 9.99"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Yearly price ($/mo billed annually)
            </Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={draft.yearlyMonthlyPrice ?? ""}
              onChange={(e) =>
                update({
                  yearlyMonthlyPrice:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="h-8 text-sm"
              placeholder="e.g. 8.25"
            />
          </div>
        </div>
        {yearlyTotal != null ? (
          <p className="text-xs text-muted-foreground">
            Stripe yearly charge: ${yearlyTotal} / year
          </p>
        ) : null}

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Input
            value={draft.marketingBlurb}
            onChange={(e) => update({ marketingBlurb: e.target.value })}
            className="h-8 text-sm"
            placeholder="Short description on the add-on catalog card"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Product details</Label>
          <Input
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            className="h-8 text-sm"
            placeholder="Longer product copy stored on the Stripe product"
          />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Save updates Flipvise and the matching Stripe product. Stripe prices cannot be
          edited in place — a new price is created when the amount changes. Env:{" "}
          <span className="font-mono">{item.stripePriceEnvKey || "not set"}</span>
          {item.stripeMonthlyConfigured ? "" : " · monthly price ID missing"}
          {item.stripeYearlyConfigured ? "" : " · yearly price ID missing"}
        </p>
      </CardContent>
    </Card>
  );
}

export function AdminAddonPlansEditor({
  initialAddons,
}: {
  initialAddons: AdminAddonPlanEditorItem[];
}) {
  const [addons, setAddons] = useState(initialAddons);
  const [activeTab, setActiveTab] = useState(initialAddons[0]?.key ?? "");

  if (addons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No add-ons in the catalog yet. Register them on /admin/add-ons first.
      </p>
    );
  }

  const active = addons.find((row) => row.key === activeTab) ?? addons[0];

  return (
    <div className="space-y-0">
      <div className="flex flex-wrap gap-0 overflow-x-auto border-b border-border">
        {addons.map((addon) => {
          const isActive = addon.key === activeTab;
          return (
            <button
              key={addon.key}
              type="button"
              onClick={() => setActiveTab(addon.key)}
              className={[
                "relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              ].join(" ")}
            >
              {addon.name}
            </button>
          );
        })}
      </div>
      {active ? (
        <div className="pt-4">
          <AddonPlanEditor
            key={active.key}
            item={active}
            onSaved={(updated) =>
              setAddons((prev) =>
                prev.map((row) => (row.key === updated.key ? updated : row)),
              )
            }
          />
        </div>
      ) : null}
    </div>
  );
}
