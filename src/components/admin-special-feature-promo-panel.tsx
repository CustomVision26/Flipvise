"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PromoShareKit } from "@/components/promo-share-kit";
import {
  createSpecialFeaturePromoAction,
  listSpecialFeaturePromosAction,
  setSpecialFeaturePromoActiveAction,
  type SpecialFeaturePromoView,
} from "@/actions/special-feature-promos";
import { STRIPE_PAID_PLAN_IDS } from "@/lib/billing-plan-ids";
import {
  labelForAdminPlanAssignment,
  type AdminPlanAssignment,
} from "@/lib/admin-assignable-plans";

const CHANNELS = [
  { id: "expo", label: "Expo promo" },
  { id: "tv", label: "TV promo" },
  { id: "social", label: "Social media promo" },
] as const;

function suggestCode(channel: string): string {
  const prefix = channel === "tv" ? "TV" : channel === "social" ? "SOCIAL" : "EXPO";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

export function AdminSpecialFeaturePromoPanel() {
  const [promos, setPromos] = useState<SpecialFeaturePromoView[]>([]);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["id"]>("expo");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState(() => suggestCode("expo"));
  const [percentOff, setPercentOff] = useState("10");
  const [planIds, setPlanIds] = useState<string[]>(["pro"]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void listSpecialFeaturePromosAction()
      .then((rows) => {
        if (!cancelled) setPromos(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load promos.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function togglePlan(id: string, checked: boolean) {
    setPlanIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((planId) => planId !== id),
    );
  }

  function createPromo() {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createSpecialFeaturePromoAction({
          channel,
          label,
          code,
          percentOff: Number(percentOff),
          planIds,
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
        });
        setPromos((current) => [created, ...current]);
        setLabel("");
        setCode(suggestCode(channel));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create the promo.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Create an expo, TV, or social media code. Flipvise creates the matching Stripe coupon so
        checkout applies the percent to the plans you select.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select
            value={channel}
            onValueChange={(value) => {
              const next = (value ?? "expo") as (typeof CHANNELS)[number]["id"];
              setChannel(next);
              setCode(suggestCode(next));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Percent off</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={percentOff}
            onChange={(event) => setPercentOff(event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Label</Label>
          <Input
            value={label}
            placeholder="e.g. Expo booth 2026"
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Promo code</Label>
          <Input
            value={code}
            className="font-mono"
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Start date</Label>
          <Input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>End date</Label>
          <Input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Plans this code can be used with</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {STRIPE_PAID_PLAN_IDS.map((planId) => (
            <label key={planId} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={planIds.includes(planId)}
                onCheckedChange={(checked) => togglePlan(planId, checked === true)}
              />
              <span>{labelForAdminPlanAssignment(planId as AdminPlanAssignment)}</span>
            </label>
          ))}
        </div>
      </div>
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      <Button type="button" onClick={createPromo} disabled={pending || planIds.length === 0}>
        {pending ? "Creating…" : "Create Stripe promo"}
      </Button>
      <div className="space-y-3">
        {promos.map((promo) => (
          <div key={promo.id} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {CHANNELS.find((item) => item.id === promo.channel)?.label ?? promo.channel}
              </Badge>
              <span className="text-sm font-medium">{promo.label}</span>
              <span className="text-sm text-muted-foreground">{promo.percentOff}% off</span>
              <Badge variant={promo.active ? "default" : "outline"}>
                {promo.active ? "Active" : "Inactive"}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => {
                  startTransition(async () => {
                    await setSpecialFeaturePromoActiveAction({
                      id: promo.id,
                      active: !promo.active,
                    });
                    setPromos((current) =>
                      current.map((row) =>
                        row.id === promo.id ? { ...row, active: !promo.active } : row,
                      ),
                    );
                  });
                }}
              >
                {promo.active ? "Turn off" : "Turn on"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {promo.planIds
                .map((id) => labelForAdminPlanAssignment(id as AdminPlanAssignment))
                .join(", ")}
            </p>
            <PromoShareKit
              code={promo.code}
              caption="Open the link or scan the QR code. Pricing fills this code and highlights the plans it can be used with."
            />
          </div>
        ))}
      </div>
    </div>
  );
}
