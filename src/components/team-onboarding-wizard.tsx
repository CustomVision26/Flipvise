"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeamAction } from "@/actions/teams";
import type { TeamPlanId } from "@/lib/team-plans";

interface TeamOnboardingWizardProps {
  planSlug: TeamPlanId;
}

export function TeamOnboardingWizard({ planSlug }: TeamOnboardingWizardProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createTeamAction({ name, planSlug });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create team");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="team-name">Team name</Label>
        <Input
          id="team-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. New York High School"
          disabled={pending}
          maxLength={255}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Continue to Personal dashboard"}
      </Button>
    </form>
  );
}
