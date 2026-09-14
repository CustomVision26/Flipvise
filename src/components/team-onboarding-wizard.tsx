"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  const [pending, setPending] = React.useState(false);
  const previewName = previewWorkspaceName(draft);
  const canSubmit = previewName.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = workspaceCreateProfileSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error("Choose an option and fill in every required field.");
      return;
    }
    setPending(true);
    try {
      const result = await createTeamAction({ ...parsed.data, planSlug });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Workspace created", {
        description: previewName
          ? `${previewName} is ready.`
          : "Opening your personal dashboard…",
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      toast.error(
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
      <Button type="submit" disabled={pending || !canSubmit}>
        {pending ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}
