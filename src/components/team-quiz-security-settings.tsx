"use client";

import * as React from "react";
import { Shield } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTeamQuizSecurityAction } from "@/actions/quiz-security";
import type { QuizSecurityWorkspaceSnapshot } from "@/db/queries/quiz-security";
import { cn } from "@/lib/utils";

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";

type TeamQuizSecuritySettingsProps = {
  workspaces: QuizSecurityWorkspaceSnapshot[];
  defaultWorkspaceId: number;
};

export function TeamQuizSecuritySettings({
  workspaces,
  defaultWorkspaceId,
}: TeamQuizSecuritySettingsProps) {
  const [selectedId, setSelectedId] = React.useState(defaultWorkspaceId);
  const [enabledById, setEnabledById] = React.useState<Record<number, boolean>>(() =>
    Object.fromEntries(workspaces.map((w) => [w.id, w.quizSecurityEnabled])),
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSelectedId(defaultWorkspaceId);
  }, [defaultWorkspaceId]);

  React.useEffect(() => {
    setEnabledById(Object.fromEntries(workspaces.map((w) => [w.id, w.quizSecurityEnabled])));
  }, [workspaces]);

  const selected =
    workspaces.find((w) => w.id === selectedId) ?? workspaces[0] ?? null;
  const enabled = selected ? Boolean(enabledById[selected.id]) : false;

  async function handleToggle(checked: boolean) {
    if (!selected) return;
    setError(null);
    setEnabledById((prev) => ({ ...prev, [selected.id]: checked }));
    setSaving(true);
    try {
      await updateTeamQuizSecurityAction({ teamId: selected.id, enabled: checked });
    } catch (e) {
      setEnabledById((prev) => ({ ...prev, [selected.id]: !checked }));
      setError(e instanceof Error ? e.message : "Could not update quiz security.");
    } finally {
      setSaving(false);
    }
  }

  if (workspaces.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="max-w-md space-y-1.5">
        <Label
          htmlFor="quiz-security-workspace"
          className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
        >
          Workspace
        </Label>
        <Select
          value={String(selectedId)}
          onValueChange={(v) => {
            if (v != null) setSelectedId(Number(v));
          }}
        >
          <SelectTrigger id="quiz-security-workspace" className="h-10 w-full bg-background">
            <SelectValue placeholder={PLACEHOLDER_WORKSPACE}>
              {selected?.name ?? PLACEHOLDER_WORKSPACE}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((workspace) => (
              <SelectItem key={workspace.id} value={String(workspace.id)}>
                <span className="truncate">{workspace.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected ? (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border/80 bg-muted/15 p-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="font-medium text-foreground">{selected.name}</p>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When on, members cannot leave the quiz UI until they submit. Leaving locks the session
              until you grant access or terminate it.
            </p>
            <p
              className={cn(
                "text-xs font-medium",
                enabled ? "text-emerald-400" : "text-muted-foreground",
              )}
            >
              {enabled ? "Enabled for this workspace" : "Disabled for this workspace"}
            </p>
          </div>
          <Switch
            id={`quiz-security-${selected.id}`}
            checked={enabled}
            disabled={saving}
            onCheckedChange={handleToggle}
            aria-label={`Quiz security for ${selected.name}`}
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
