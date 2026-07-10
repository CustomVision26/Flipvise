import { isEducationTeamPlanId } from "@/lib/education-plans";

export const TEAM_MEMBER_STUDY_PRIVILEGES = [
  "standard_review",
  "quiz",
  "both",
] as const;

export type TeamMemberStudyPrivilege = (typeof TEAM_MEMBER_STUDY_PRIVILEGES)[number];

export type ResolvedMemberStudyModes = {
  allowReview: boolean;
  allowQuiz: boolean;
};

export const TEAM_MEMBER_STUDY_PRIVILEGE_LABELS: Record<TeamMemberStudyPrivilege, string> = {
  standard_review: "Standard Review only",
  quiz: "Quiz only",
  both: "Standard Review & Quiz",
};

export function isTeamMemberStudyPrivilege(value: string): value is TeamMemberStudyPrivilege {
  return (TEAM_MEMBER_STUDY_PRIVILEGES as readonly string[]).includes(value);
}

export function resolveMemberStudyModes(
  privilege: TeamMemberStudyPrivilege,
): ResolvedMemberStudyModes {
  return {
    allowReview: privilege === "standard_review" || privilege === "both",
    allowQuiz: privilege === "quiz" || privilege === "both",
  };
}

export function defaultTeamMemberStudyPrivilege(): TeamMemberStudyPrivilege {
  return "both";
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
