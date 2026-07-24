import { isEducationTeamPlanId } from "@/lib/education-plans";

/**
 * Per-deck study modes for team member (and Education team-admin) assignments.
 * Legacy values `standard_review`, `quiz`, and `both` remain valid in the DB.
 */
export const TEAM_MEMBER_STUDY_PRIVILEGES = [
  "standard_review",
  "ai_recall",
  "quiz",
  "review_and_ai_recall",
  "both",
  "ai_recall_and_quiz",
  "all",
] as const;

export type TeamMemberStudyPrivilege = (typeof TEAM_MEMBER_STUDY_PRIVILEGES)[number];

export type ResolvedMemberStudyModes = {
  allowReview: boolean;
  allowAiRecall: boolean;
  allowQuiz: boolean;
};

export const TEAM_MEMBER_STUDY_PRIVILEGE_LABELS: Record<TeamMemberStudyPrivilege, string> = {
  standard_review: "Standard Review only",
  ai_recall: "AI Recall™ only",
  quiz: "Quiz only",
  review_and_ai_recall: "Standard Review & AI Recall™",
  both: "Standard Review & Quiz",
  ai_recall_and_quiz: "AI Recall™ & Quiz",
  all: "Standard Review, AI Recall™ & Quiz",
};

export function isTeamMemberStudyPrivilege(value: string): value is TeamMemberStudyPrivilege {
  return (TEAM_MEMBER_STUDY_PRIVILEGES as readonly string[]).includes(value);
}

export function resolveMemberStudyModes(
  privilege: TeamMemberStudyPrivilege,
): ResolvedMemberStudyModes {
  switch (privilege) {
    case "standard_review":
      return { allowReview: true, allowAiRecall: false, allowQuiz: false };
    case "ai_recall":
      return { allowReview: false, allowAiRecall: true, allowQuiz: false };
    case "quiz":
      return { allowReview: false, allowAiRecall: false, allowQuiz: true };
    case "review_and_ai_recall":
      return { allowReview: true, allowAiRecall: true, allowQuiz: false };
    case "both":
      return { allowReview: true, allowAiRecall: false, allowQuiz: true };
    case "ai_recall_and_quiz":
      return { allowReview: false, allowAiRecall: true, allowQuiz: true };
    case "all":
      return { allowReview: true, allowAiRecall: true, allowQuiz: true };
    default: {
      const _exhaustive: never = privilege;
      void _exhaustive;
      return { allowReview: true, allowAiRecall: true, allowQuiz: true };
    }
  }
}

/** New assignments default to all three modes (including AI Recall™). */
export function defaultTeamMemberStudyPrivilege(): TeamMemberStudyPrivilege {
  return "all";
}

/** Roles that may have per-deck study mode limits on Education Gold / Enterprise. */
export function memberRoleQualifiesForStudyPrivileges(
  role: "team_admin" | "team_member",
  planSlug: string,
): boolean {
  if (role === "team_member") return true;
  if (role === "team_admin") {
    return isEducationTeamPlanId(planSlug);
  }
  return false;
}
