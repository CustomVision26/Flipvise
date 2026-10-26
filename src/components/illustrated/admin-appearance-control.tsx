"use client";

import * as React from "react";
import { updateAdminAppearanceSettingsAction } from "@/actions/appearance";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function AdminAppearanceControl({
  initial,
}: {
  initial: {
    illustratedDesignEnabled: boolean;
    updatedAt: string | null;
    updatedByLabel: string | null;
  };
}) {
  const appearance = useIllustratedAppearance();
  const [enabled, setEnabled] = React.useState(initial.illustratedDesignEnabled);
  const [saved, setSaved] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedMessage, setSavedMessage] = React.useState<string | null>(null);

  const dirty = enabled !== saved.illustratedDesignEnabled;

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const next = await updateAdminAppearanceSettingsAction({
        illustratedDesignEnabled: enabled,
      });
      setSaved(next);
      setSavedMessage("Saved. User preferences were not changed.");
      await appearance.refreshSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the master switch.");
    } finally {
      setSaving(false);
    }
  }

  const updatedLabel = saved.updatedAt
    ? new Date(saved.updatedAt).toLocaleString()
    : "Not saved yet";

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Illustrated Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Allow users on every plan, including Free, to enable illustrated decks, backgrounds, and study screens. Turning this off displays the
          standard design for everyone.
        </p>
        <p className="text-sm text-muted-foreground">
          Individual user preferences and saved artwork are preserved.
        </p>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label htmlFor="admin-illustrated-design">Enable Illustrated Deck Design</Label>
          <p id="admin-illustrated-design-note" className="text-sm text-muted-foreground">
            Current availability: {saved.illustratedDesignEnabled ? "On" : "Off"}.
          </p>
        </div>
        <Switch
          id="admin-illustrated-design"
          checked={enabled}
          disabled={saving}
          aria-describedby="admin-illustrated-design-note"
          onCheckedChange={setEnabled}
        />
      </div>

      <dl className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Last updated</dt>
          <dd>{updatedLabel}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Updated by</dt>
          <dd>{saved.updatedByLabel ?? "—"}</dd>
        </div>
      </dl>

      <p className="text-sm text-muted-foreground">
        Open, visible sessions pick this up within about 60 seconds, or sooner when the tab is
        focused or the device reconnects. A fully offline device keeps its last look until it
        reconnects.
      </p>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <p className="sr-only" role="status" aria-live="polite">
          {saving ? "Saving feature control." : savedMessage}
        </p>
        {savedMessage ? <p className="text-sm text-muted-foreground">{savedMessage}</p> : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
