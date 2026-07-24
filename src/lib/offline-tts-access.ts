import { resolvePersonalWorkspaceLabelsForUserId } from "@/lib/personal-workspace-plan-label";

/**
 * Session-independent AI reading gate for device-sync-token TTS calls.
 * Mirrors personal Pro Plus / team-tier / platform-admin access (not Free or Pro).
 */
export async function resolveHasAiReadingForUserId(
  userId: string,
): Promise<boolean> {
  const labels = await resolvePersonalWorkspaceLabelsForUserId(userId);
  if (labels.viewerIsPlatformAdmin || labels.viewerIsSuperadmin) return true;
  if (labels.personalHasTeamTierPlan) return true;
  const plan = labels.personalAccountPlanLabel.trim().toLowerCase();
  return plan === "pro plus";
}
