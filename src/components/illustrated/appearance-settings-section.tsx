"use client";

import { useEffect, useState } from "react";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import {
  BACKGROUND_CHANGE_HOURS_MAX,
  BACKGROUND_CHANGE_HOURS_MIN,
  clampBackgroundChangeHours,
} from "@/lib/illustrated-appearance";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

export function AppearanceSettingsSection() {
  const appearance = useIllustratedAppearance();
  const unavailable = !appearance.globalEnabled;
  const [hours, setHours] = useState(appearance.backgroundChangeHours);
  useEffect(() => {
    setHours(appearance.backgroundChangeHours);
  }, [appearance.backgroundChangeHours]);
  const scheduleLocked = !appearance.backgroundChangeEnabled;
  const status = appearance.saving
    ? "Saving appearance settings."
    : appearance.error
      ? appearance.error
      : null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Illustrated deck design</h2>
        <p className="text-sm text-muted-foreground">
          Show cartoon-style artwork and layered designs across your decks and study screens.
        </p>
        <p className="text-sm text-muted-foreground">
          Your study content and available features stay the same. Cartoon artwork and backgrounds are included on every plan, including Free.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="illustrated-deck-design">Illustrated Deck Design</Label>
          {unavailable ? (
            <p id="illustrated-deck-design-note" className="text-sm text-muted-foreground">
              Illustrated designs are temporarily unavailable. Your preference will be remembered.
              {appearance.userPreferred
                ? " Saved preference: on. This is not the active appearance."
                : " Saved preference: off."}
            </p>
          ) : (
            <p id="illustrated-deck-design-note" className="text-sm text-muted-foreground">
              {appearance.effectiveIllustratedDesign
                ? "Illustrated design is on."
                : "Standard design is on."}
            </p>
          )}
        </div>
        <Switch
          id="illustrated-deck-design"
          checked={unavailable ? false : appearance.userPreferred}
          disabled={unavailable || appearance.saving || !appearance.userId}
          aria-describedby="illustrated-deck-design-note"
          onCheckedChange={(checked) => {
            void appearance.updatePreferences({
              illustratedDesignPreferred: checked,
            });
          }}
        />
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="background-artwork-changes">Change background artwork</Label>
            <p id="background-artwork-changes-note" className="text-sm text-muted-foreground">
              {appearance.backgroundChangeEnabled
                ? `The scene you see now stays for ${hours} hours, then changes to the next scene. Choose anywhere from ${BACKGROUND_CHANGE_HOURS_MIN} hours to ${BACKGROUND_CHANGE_HOURS_MAX} hours.`
                : "Background artwork stays on the current scene."}
            </p>
          </div>
          <Switch
            id="background-artwork-changes"
            checked={appearance.backgroundChangeEnabled}
            disabled={appearance.saving || !appearance.userId}
            aria-describedby="background-artwork-changes-note"
            onCheckedChange={(checked) => {
              void appearance.updatePreferences({ backgroundChangeEnabled: checked });
            }}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="background-change-hours">Hours between changes</Label>
            <p className="text-sm font-medium text-foreground tabular-nums">{hours} hours</p>
          </div>
          <Slider
            id="background-change-hours"
            min={BACKGROUND_CHANGE_HOURS_MIN}
            max={BACKGROUND_CHANGE_HOURS_MAX}
            step={1}
            value={hours}
            disabled={scheduleLocked || appearance.saving || !appearance.userId}
            getAriaLabel={() => "Hours between background changes"}
            getAriaValueText={(_formatted, value) => `${value} hours`}
            onValueChange={(value) => {
              const next = clampBackgroundChangeHours(Array.isArray(value) ? value[0] : value);
              setHours(next);
            }}
            onValueCommitted={(value) => {
              const next = clampBackgroundChangeHours(Array.isArray(value) ? value[0] : value);
              if (next === appearance.backgroundChangeHours) return;
              void appearance.updatePreferences({ backgroundChangeHours: next });
            }}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
        <div className="space-y-1">
          <Label htmlFor="reduce-animations">Reduce animations</Label>
          <p id="reduce-animations-note" className="text-sm text-muted-foreground">
            Keep illustrations while reducing movement and transitions.
          </p>
          {appearance.systemPrefersReducedMotion ? (
            <p className="text-sm text-muted-foreground">
              Your device&apos;s reduced-motion preference is being respected.
            </p>
          ) : null}
        </div>
        <Switch
          id="reduce-animations"
          checked={appearance.userReduceAnimations}
          disabled={appearance.saving || !appearance.userId}
          aria-describedby="reduce-animations-note"
          onCheckedChange={(checked) => {
            void appearance.updatePreferences({ reduceAnimations: checked });
          }}
        />
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {appearance.error ? (
        <p className="text-sm text-destructive" role="alert">
          {appearance.error}
        </p>
      ) : null}
      {appearance.saving ? (
        <p className="text-sm text-muted-foreground">Saving…</p>
      ) : null}
    </div>
  );
}
