"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { createAddonCheckoutSessionAction } from "@/actions/addons";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DashboardAddonBannerItem = {
  key: string;
  name: string;
  blurb: string;
  unlocked: boolean;
  canPurchase: boolean;
  /** Destination when unlocked; omit to open unlock flow. */
  href?: string | null;
};

/** Distinct chip colors (readable on dark UI). */
const ADDON_CHIP_STYLES = [
  "bg-teal-600 text-white shadow-teal-900/40",
  "bg-amber-600 text-white shadow-amber-900/40",
  "bg-rose-600 text-white shadow-rose-900/40",
  "bg-sky-600 text-white shadow-sky-900/40",
  "bg-violet-600 text-white shadow-violet-900/40",
  "bg-emerald-600 text-white shadow-emerald-900/40",
  "bg-orange-600 text-white shadow-orange-900/40",
  "bg-fuchsia-600 text-white shadow-fuchsia-900/40",
] as const;

const ADDON_KEY_COLOR_INDEX: Record<string, number> = {
  [AI_ESSAY_ADDON_KEY]: 0,
  study_mode_focus: 1,
};

function chipClassForAddon(key: string, index: number): string {
  const mapped = ADDON_KEY_COLOR_INDEX[key];
  const i =
    typeof mapped === "number" ? mapped : index % ADDON_CHIP_STYLES.length;
  return ADDON_CHIP_STYLES[i]!;
}

type DashboardAddonsBannerProps = {
  addons: DashboardAddonBannerItem[];
  signedIn: boolean;
};

export function DashboardAddonsBanner({
  addons,
  signedIn,
}: DashboardAddonsBannerProps) {
  const router = useRouter();
  const [unlockTarget, setUnlockTarget] =
    React.useState<DashboardAddonBannerItem | null>(null);
  const [period, setPeriod] = React.useState<"monthly" | "yearly">("monthly");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (addons.length === 0) return null;

  // Duplicate the strip so the CSS marquee can loop seamlessly.
  const strip = [...addons, ...addons];

  async function handlePurchase() {
    if (!unlockTarget) return;
    setError(null);
    setPending(true);
    try {
      const result = await createAddonCheckoutSessionAction({
        addonKey: unlockTarget.key,
        period,
      });
      if (result.mode === "attached") {
        setUnlockTarget(null);
        router.refresh();
        return;
      }
      router.push(
        `/pricing/add-ons/pay?session_id=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
    } finally {
      setPending(false);
    }
  }

  function onChipActivate(item: DashboardAddonBannerItem) {
    if (item.unlocked && item.href) {
      router.push(item.href);
      return;
    }
    if (item.unlocked) {
      router.push("/pricing/add-ons");
      return;
    }
    setPeriod("monthly");
    setError(null);
    setUnlockTarget(item);
  }

  return (
    <>
      <div
        className="relative -mx-4 overflow-hidden border-y border-border/50 bg-card/40 sm:-mx-8"
        role="region"
        aria-label="Premium add-ons"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent sm:w-12" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent sm:w-12" />

        <div className="flex w-max animate-addons-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
          {strip.map((item, index) => {
            const color = chipClassForAddon(item.key, index % addons.length);
            const label = item.unlocked
              ? `${item.name} · Open`
              : `${item.name} · Unlock`;
            return (
              <button
                key={`${item.key}-${index}`}
                type="button"
                onClick={() => onChipActivate(item)}
                className={cn(
                  "m-1.5 inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-md transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                  color,
                )}
                title={item.blurb || item.name}
              >
                {item.unlocked ? (
                  <Sparkles className="size-3.5 opacity-90" aria-hidden />
                ) : (
                  <Lock className="size-3.5 opacity-90" aria-hidden />
                )}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog
        open={unlockTarget != null}
        onOpenChange={(open) => {
          if (!open) setUnlockTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock {unlockTarget?.name ?? "add-on"}</DialogTitle>
            <DialogDescription>
              {unlockTarget?.blurb ||
                "Optional premium add-on on top of your current plan."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="addon-banner-period">Billing period</Label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as "monthly" | "yearly")}
              >
                <SelectTrigger id="addon-banner-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!signedIn ? (
              <p className="text-sm text-muted-foreground">
                Sign in from the homepage, then return to unlock this add-on.
              </p>
            ) : unlockTarget && !unlockTarget.canPurchase ? (
              <p className="text-sm text-muted-foreground">
                Your plan may not be eligible, or Stripe pricing is not
                configured. Ask a Team Admin or platform admin for access, or
                visit{" "}
                <Link href="/pricing/add-ons" className="underline">
                  Add-on Catalog
                </Link>
                .
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUnlockTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handlePurchase()}
              disabled={
                pending ||
                !signedIn ||
                !unlockTarget?.canPurchase
              }
            >
              Unlock Feature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
