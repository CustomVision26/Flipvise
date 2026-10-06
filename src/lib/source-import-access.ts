/**
 * Basic import (URL + plain text) — Pro personal, team-tier deck editors, and platform admins.
 */
export function canUseBasicSourceImport(input: {
  hasAI: boolean;
  teamTierProWorkspace: boolean;
}): boolean {
  return input.hasAI || input.teamTierProWorkspace;
}

/**
 * Advanced import (PDF, Word, PPT, handwriting) — Pro Plus personal, team-tier
 * workspaces, Teacher Dashboard tools, and admins.
 * Mirrors the Pro Plus gate used for listen-to-card ({@link AccessContext.hasAiReading})
 * and is always on for anyone who can use Lesson Builder / Study Guides.
 */
export function canUseAdvancedSourceImport(input: {
  hasAiReading: boolean;
  teamTierProWorkspace: boolean;
  hasTeacherTools?: boolean;
}): boolean {
  return (
    input.hasAiReading ||
    input.teamTierProWorkspace ||
    Boolean(input.hasTeacherTools)
  );
}
