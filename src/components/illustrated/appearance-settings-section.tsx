"use client";

import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function AppearanceSettingsSection() {
  const appearance = useIllustratedAppearance();
  const freePlan = !appearance.planAllowsIllustrated;
  const unavailable = freePlan || !appearance.globalEnabled;
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
          Your study content and available features stay the same. Cartoon style is included on every plan except Free.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="illustrated-deck-design">Illustrated Deck Design</Label>
          {freePlan ? (
            <p id="illustrated-deck-design-note" className="text-sm text-muted-foreground">
              Free accounts use the standard design. Cartoon style is available on every other plan.
              {appearance.userPreferred
                ? " Saved preference: on. This is not the active appearance."
                : ""}
            </p>
          ) : unavailable ? (
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
