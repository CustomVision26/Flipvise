import { redirect } from "next/navigation";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import { getAccessContext, type AccessContext } from "@/lib/access";
import { hasEducationPlan } from "@/lib/education-plans";

async function resolveEducationWorkspacePlanSlug(
  userId: string,
): Promise<string | null> {
  const teams = await getTeamsForTeamDashboard(userId);
  const match = teams.find((t) => hasEducationPlan(t.planSlug));
  return match?.planSlug ?? null;
}

/** Personal education plan or membership in an education team workspace. */
export async function userHasTeacherToolsAccess(
  ctx: Pick<AccessContext, "userId" | "canAccessTeacherTools">,
): Promise<boolean> {
  if (ctx.canAccessTeacherTools) return true;
  if (!ctx.userId) return false;
  const workspacePlanSlug = await resolveEducationWorkspacePlanSlug(ctx.userId);
  return workspacePlanSlug !== null;
}

/** Server-side gate for teacher tool Server Actions (lesson builder, quiz generator, etc.). */
export async function requireTeacherToolsAccess(
  ctx: AccessContext,
  errorMessage: string,
): Promise<{ userId: string }> {
  if (!ctx.userId) {
    throw new Error("Unauthorized");
  }
  if (!(await userHasTeacherToolsAccess(ctx))) {
    throw new Error(errorMessage);
  }
  return { userId: ctx.userId };
}

/** Server-side gate for all `/teacher/*` routes. */
export async function requireTeacherDashboardAccess(): Promise<{
  userId: string;
  effectivePlanSlug: string;
}> {
  const ctx = await getAccessContext();
  if (!ctx.userId) {
    redirect("/pricing");
  }

  if (ctx.canAccessTeacherTools && ctx.effectivePlanSlug) {
    return {
      userId: ctx.userId,
      effectivePlanSlug: ctx.effectivePlanSlug,
    };
  }

  const workspacePlanSlug = await resolveEducationWorkspacePlanSlug(ctx.userId);
  if (workspacePlanSlug) {
    return {
      userId: ctx.userId,
      effectivePlanSlug: workspacePlanSlug,
    };
  }

  redirect("/pricing");
}
