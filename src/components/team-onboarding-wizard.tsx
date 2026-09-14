"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { WorkspaceCreateProfileFields } from "@/components/workspace-create-profile-fields";
import { createTeamAction } from "@/actions/teams";
import { isProductionOmittedServerError } from "@/lib/server-action-client-error";
import type { WorkspaceCreatePlanId } from "@/lib/education-plans";
import {
  EMPTY_WORKSPACE_CREATE_DRAFT,
  previewWorkspaceName,
  workspaceCreateProfileSchema,
  type WorkspaceCreateDraft,
} from "@/lib/workspace-creation-profile";

interface TeamOnboardingWizardProps {
  planSlug: WorkspaceCreatePlanId;
}

export function TeamOnboardingWizard({ planSlug }: TeamOnboardingWizardProps) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<WorkspaceCreateDraft>(() => ({
    ...EMPTY_WORKSPACE_CREATE_DRAFT,
  }));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const canSubmit = previewWorkspaceName(draft).length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = workspaceCreateProfileSchema.safeParse(draft);
    if (!parsed.success) {
      setError("Choose an option and fill in every required field.");
      return;
    }
    setPending(true);
    try {
      const result = await createTeamAction({ ...parsed.data, planSlug });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      setError(
        raw && !isProductionOmittedServerError(raw)
          ? raw
          : "Could not create the workspace. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <WorkspaceCreateProfileFields
        idPrefix="team-onboarding"
        draft={draft}
        onChange={setDraft}
        disabled={pending}
      />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !canSubmit}>
        {pending ? "Creating…" : "Continue to Personal dashboard"}
      </Button>
    </form>
  );
}
