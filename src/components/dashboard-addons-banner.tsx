"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";
import { createAddonCheckoutSessionAction } from "@/actions/addons";
import { AI_ESSAY_ADDON_KEY, LIVE_CLASSROOM_ADDON_KEY } from "@/lib/addon-keys";
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
import type { DashboardAddonBannerItem } from "@/lib/dashboard-addon-banner-items";

export type { DashboardAddonBannerItem };

/** Soft accent chips — readable on dark UI without solid candy fills. */
const ADDON_CHIP_STYLES = [
  "border-teal-500/35 bg-teal-500/10 text-teal-100 hover:bg-teal-500/18",
  "border-amber-500/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/18",
  "border-rose-500/35 bg-rose-500/10 text-rose-100 hover:bg-rose-500/18",
  "border-sky-500/35 bg-sky-500/10 text-sky-100 hover:bg-sky-500/18",
  "border-indigo-500/35 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/18",
  "border-emerald-500/35 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/18",
  "border-orange-500/35 bg-orange-500/10 text-orange-100 hover:bg-orange-500/18",
  "border-fuchsia-500/35 bg-fuchsia-500/10 text-fuchsia-100 hover:bg-fuchsia-500/18",
] as const;

const ADDON_ICON_STYLES = [
  "bg-teal-500/25 text-teal-50",
  "bg-amber-500/25 text-amber-50",
  "bg-rose-500/25 text-rose-50",
  "bg-sky-500/25 text-sky-50",
  "bg-indigo-500/25 text-indigo-50",
  "bg-emerald-500/25 text-emerald-50",
  "bg-orange-500/25 text-orange-50",
  "bg-fuchsia-500/25 text-fuchsia-50",
] as const;

const ADDON_KEY_COLOR_INDEX: Record<string, number> = {
  [AI_ESSAY_ADDON_KEY]: 0,
  study_mode_focus: 1,
  [LIVE_CLASSROOM_ADDON_KEY]: 2,
};

function colorIndexForAddon(key: string, index: number): number {
  const mapped = ADDON_KEY_COLOR_INDEX[key];
  return typeof mapped === "number" ? mapped : index % ADDON_CHIP_STYLES.length;
}

type DashboardAddonsBannerProps = {
  addons: DashboardAddonBannerItem[];
  signedIn: boolean;
  /**
   * `marquee` — full-bleed scrolling strip.
   * `header` — compact running marquee for the app top bar.
   * `inline` — static centered chip row.
   */
  variant?: "marquee" | "header" | "inline";
};

function AddonChipButton({
  item,
  colorIndex,
  onActivate,
}: {
  item: DashboardAddonBannerItem;
  colorIndex: number;
  onActivate: (item: DashboardAddonBannerItem) => void;
}) {
  const label = item.unlocked
    ? `${item.name} · Open`
    : `${item.name} · Unlock`;
  const chip = ADDON_CHIP_STYLES[colorIndex]!;
  const icon = ADDON_ICON_STYLES[colorIndex]!;

  return (
    <button
      type="button"
      onClick={() => onActivate(item)}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 sm:py-1.5 sm:text-sm",
        chip,
      )}
      title={item.blurb || item.name}
    >
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-sm",
          icon,
        )}
        aria-hidden
      >
        {item.unlocked ? (
          <Sparkles className="size-3" />
        ) : (
          <Lock className="size-3" />
        )}
      </span>
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

export function DashboardAddonsBanner({
  addons,
  signedIn,
  variant = "marquee",
}: DashboardAddonsBannerProps) {
  const router = useRouter();
  const [unlockTarget, setUnlockTarget] =
    React.useState<DashboardAddonBannerItem | null>(null);
  const [period, setPeriod] = React.useState<"monthly" | "yearly">("monthly");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (addons.length === 0) return null;

  // Duplicate the strip so the CSS marquee can loop seamlessly.
  // Android native disables the animation via globals.css (GPU corruption).
  const strip = [...addons, ...addons];

  async function handlePurchase() {
    if (!unlockTarget) return;
    // Banner mounts in the root layout — close before navigate or the dialog
    // stays on top of /pricing/add-ons/pay.
    const target = unlockTarget;
    const selectedPeriod = period;
    setError(null);
    setPending(true);
    setUnlockTarget(null);
    try {
      const result = await createAddonCheckoutSessionAction({
        addonKey: target.key,
        period: selectedPeriod,
      });
      router.push(
        `/pricing/add-ons/pay?session_id=${encodeURIComponent(result.sessionId)}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setUnlockTarget(target);
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

  const marqueeTrack = (
    <div className="flex w-max items-center gap-2 py-1.5 pe-2 ps-2 animate-addons-marquee hover:[animation-play-state:paused] motion-reduce:animate-none sm:gap-2.5">
      {strip.map((item, index) => (
        <AddonChipButton
          key={`${item.key}-${index}`}
          item={item}
          colorIndex={colorIndexForAddon(item.key, index % addons.length)}
          onActivate={onChipActivate}
        />
      ))}
    </div>
  );

  const chips =
    variant === "inline" ? (
      <div
        className="flex flex-wrap items-center justify-center gap-2"
        role="region"
        aria-label="Premium add-ons"
      >
        {addons.map((item, index) => (
          <AddonChipButton
            key={item.key}
            item={item}
            colorIndex={colorIndexForAddon(item.key, index)}
            onActivate={onChipActivate}
          />
        ))}
      </div>
    ) : variant === "header" ? (
      <div
        data-addons-banner="header"
        className="relative w-full max-w-full overflow-hidden rounded-md border border-border/60 bg-muted/25"
        role="region"
        aria-label="Premium add-ons"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-7 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-7 bg-gradient-to-l from-background via-background/80 to-transparent" />
        {marqueeTrack}
      </div>
    ) : (
      <div
        className="relative -mx-4 overflow-hidden border-y border-border/50 bg-muted/20 sm:-mx-8"
        role="region"
        aria-label="Premium add-ons"
      >
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-background to-transparent sm:w-14" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-background to-transparent sm:w-14" />
        {marqueeTrack}
      </div>
    );

  return (
    <>
      {chips}

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
