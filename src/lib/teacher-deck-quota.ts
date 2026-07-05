import type { EducationPlanId } from "@/lib/education-plans";

export type TeacherDeckQuota = {
  deckCount: number;
  maxDecks: number;
  /** Max cards allowed in each deck on the user's plan. */
  maxCardsPerDeck: number;
  scope: "workspace" | "personal";
  workspaceName: string | null;
  planSlug: EducationPlanId | null;
  planLabel: string;
  /** Education Gold / Enterprise subscriber without a provisioned workspace yet. */
  needsWorkspace: boolean;
  atLimit: boolean;
};

export function teacherDeckQuotaLabel(quota: TeacherDeckQuota): string {
  if (quota.scope === "workspace") {
    if (quota.workspaceName) {
      return `${quota.workspaceName} · ${quota.planLabel}`;
    }
    return `${quota.planLabel} workspace decks`;
  }

  if (quota.planSlug === "education_plus") {
    return `${quota.planLabel} personal decks`;
  }

  return "Personal decks";
}

export function teacherDeckSectionTitle(quota: TeacherDeckQuota): string {
  if (quota.scope === "workspace") {
    if (quota.workspaceName) {
      return `Workspace Decks — ${quota.workspaceName}`;
    }
    return `${quota.planLabel} Workspace Decks`;
  }

  if (quota.planSlug === "education_plus") {
    return "Your Personal Decks";
  }

  return "Your Decks";
}
