"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Circle, Lock, Sparkles } from "lucide-react";
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

/** Accent chips. Dark labels on light theme, light labels on dark theme. */
const ADDON_CHIP_STYLES = [
  "border-teal-800/40 bg-teal-700/10 text-teal-950 hover:bg-teal-700/20 dark:border-teal-200/40 dark:bg-teal-300/15 dark:text-teal-50 dark:hover:bg-teal-300/25",
  "border-amber-800/40 bg-amber-700/10 text-amber-950 hover:bg-amber-700/20 dark:border-amber-200/40 dark:bg-amber-300/15 dark:text-amber-50 dark:hover:bg-amber-300/25",
  "border-rose-800/40 bg-rose-700/10 text-rose-950 hover:bg-rose-700/20 dark:border-rose-200/40 dark:bg-rose-300/15 dark:text-rose-50 dark:hover:bg-rose-300/25",
  "border-sky-800/40 bg-sky-700/10 text-sky-950 hover:bg-sky-700/20 dark:border-sky-200/40 dark:bg-sky-300/15 dark:text-sky-50 dark:hover:bg-sky-300/25",
  "border-indigo-800/40 bg-indigo-700/10 text-indigo-950 hover:bg-indigo-700/20 dark:border-indigo-200/40 dark:bg-indigo-300/15 dark:text-indigo-50 dark:hover:bg-indigo-300/25",
  "border-emerald-800/40 bg-emerald-700/10 text-emerald-950 hover:bg-emerald-700/20 dark:border-emerald-200/40 dark:bg-emerald-300/15 dark:text-emerald-50 dark:hover:bg-emerald-300/25",
  "border-orange-800/40 bg-orange-700/10 text-orange-950 hover:bg-orange-700/20 dark:border-orange-200/40 dark:bg-orange-300/15 dark:text-orange-50 dark:hover:bg-orange-300/25",
  "border-fuchsia-800/40 bg-fuchsia-700/10 text-fuchsia-950 hover:bg-fuchsia-700/20 dark:border-fuchsia-200/40 dark:bg-fuchsia-300/15 dark:text-fuchsia-50 dark:hover:bg-fuchsia-300/25",
] as const;

const ADDON_ICON_STYLES = [
  "bg-teal-800/15 text-teal-950 dark:bg-teal-200/20 dark:text-teal-50",
  "bg-amber-800/15 text-amber-950 dark:bg-amber-200/20 dark:text-amber-50",
  "bg-rose-800/15 text-rose-950 dark:bg-rose-200/20 dark:text-rose-50",
  "bg-sky-800/15 text-sky-950 dark:bg-sky-200/20 dark:text-sky-50",
  "bg-indigo-800/15 text-indigo-950 dark:bg-indigo-200/20 dark:text-indigo-50",
  "bg-emerald-800/15 text-emerald-950 dark:bg-emerald-200/20 dark:text-emerald-50",
  "bg-orange-800/15 text-orange-950 dark:bg-orange-200/20 dark:text-orange-50",
  "bg-fuchsia-800/15 text-fuchsia-950 dark:bg-fuchsia-200/20 dark:text-fuchsia-50",
] as const;

const ADDON_KEY_COLOR_INDEX: Record<string, number> = {
  [AI_ESSAY_ADDON_KEY]: 0,
  [LIVE_CLASSROOM_ADDON_KEY]: 2,
};

function colorIndexForAddon(key: string, index: number): number {
  const mapped = ADDON_KEY_COLOR_INDEX[key];
  return typeof mapped === "number" ? mapped : index % ADDON_CHIP_STYLES.length;
}

function headerAddonRank(key: string): number {
  if (key === LIVE_CLASSROOM_ADDON_KEY) return 0;
  if (key === AI_ESSAY_ADDON_KEY) return 1;
  return 2;
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
  header = false,
}: {
  item: DashboardAddonBannerItem;
  colorIndex: number;
  onActivate: (item: DashboardAddonBannerItem) => void;
  header?: boolean;
}) {
  const headerName = item.name.replace(/^Flipvise\s+/i, "");
  const headerLabel = item.unlocked
    ? `${headerName} · Open`
    : item.comingSoon
      ? `${headerName} · Coming soon`
      : `${headerName} · Unlock`;
  const chip = ADDON_CHIP_STYLES[colorIndex]!;
  const icon = ADDON_ICON_STYLES[colorIndex]!;
  const HeaderIcon =
    item.key === LIVE_CLASSROOM_ADDON_KEY
      ? item.unlocked
        ? Circle
        : Lock
      : item.unlocked
        ? Sparkles
        : Lock;

  if (header) {
    return (
      <button
        type="button"
        data-addon-key={item.key}
        onClick={() => onActivate(item)}
        className="header-addon-pill"
        title={item.blurb || item.name}
      >
        <span className="header-addon-glyph" aria-hidden>
          {item.key === LIVE_CLASSROOM_ADDON_KEY && item.unlocked ? (
            <Image
              src="/artwork/home/team-students.png"
              alt=""
              width={40}
              height={40}
              className="header-addon-art"
            />
          ) : (
            <HeaderIcon className="size-3.5 shrink-0" />
          )}
        </span>
        <span className="whitespace-nowrap">{headerLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      data-addon-key={item.key}
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
      <span className="whitespace-nowrap">
        {item.unlocked
          ? `${item.name} - Open`
          : item.comingSoon
            ? `${item.name} - Coming soon`
            : `${item.name} - Unlock`}
      </span>
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
      await createAddonCheckoutSessionAction({
        addonKey: target.key,
        period: selectedPeriod,
      });
      router.push("/pricing/add-ons/pay");
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
    if (item.comingSoon) {
      if (item.key === AI_ESSAY_ADDON_KEY) {
        router.push("/dashboard/ai-doc-studio/ai-essay");
        return;
      }
      setError(null);
      setUnlockTarget(item);
      return;
    }
    setPeriod(
      item.monthlyPriceConfigured || !item.yearlyPriceConfigured
        ? "monthly"
        : "yearly",
    );
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
        className="header-addon-marquee relative min-w-0 overflow-hidden"
        role="region"
        aria-label="Premium add-ons"
      >
        <div className="flex w-max items-center gap-2 animate-addons-marquee hover:[animation-play-state:paused] motion-reduce:animate-none">
          {[0, 1].flatMap((copy) =>
            [...addons]
              .sort((a, b) => headerAddonRank(a.key) - headerAddonRank(b.key))
              .map((item, index) => (
                <AddonChipButton
                  key={`${item.key}-${copy}`}
                  item={item}
                  header
                  colorIndex={colorIndexForAddon(item.key, index)}
                  onActivate={onChipActivate}
                />
              )),
          )}
        </div>
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
                <SelectItem
                  value="monthly"
                  disabled={
                    unlockTarget != null &&
                    !unlockTarget.monthlyPriceConfigured
                  }
                >
                  Monthly
                </SelectItem>
                <SelectItem
                  value="yearly"
                  disabled={
                    unlockTarget != null &&
                    !unlockTarget.yearlyPriceConfigured
                  }
                >
                  Yearly
                </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!signedIn ? (
              <p className="text-sm text-muted-foreground">
                Sign in from the homepage, then return to unlock this add-on.
              </p>
            ) : unlockTarget && !unlockTarget.stripePriceConfigured ? (
              <p className="text-sm text-muted-foreground">
                Stripe pricing is not configured for this add-on. A platform
                admin must set the add-on price environment variables so the
                catalog Stripe column shows Configured, then restart the
                server.
              </p>
            ) : unlockTarget && !unlockTarget.eligible ? (
              <p className="text-sm text-muted-foreground">
                {unlockTarget.key === LIVE_CLASSROOM_ADDON_KEY ? (
                  <>
                    Live Classroom is an organization add-on for Team Basic,
                    Team Gold, Platinum, Enterprise, Education Gold, and
                    Education Enterprise. Individual Pro and Pro Plus cannot
                    purchase it. Ask a Team Admin or platform admin for access,
                    or upgrade on{" "}
                    <Link href="/pricing" className="underline">
                      Pricing
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Your current plan is not eligible for this add-on. Ask a
                    Team Admin or platform admin for access, or visit{" "}
                    <Link href="/pricing/add-ons" className="underline">
                      Add-on Catalog
                    </Link>
                    .
                  </>
                )}
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
                !unlockTarget?.canPurchase ||
                (period === "yearly"
                  ? !unlockTarget.yearlyPriceConfigured
                  : !unlockTarget.monthlyPriceConfigured)
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
