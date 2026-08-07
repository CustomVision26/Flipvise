"use server";

import { revalidatePath } from "next/cache";
import {
  deleteLiveClassroomSession,
  getLiveClassroomSessionById,
  returnLiveClassroomSessionToLobby,
} from "@/db/queries/live-classroom";
import { requireLiveClassroomAccess } from "@/lib/live-classroom-access";
import {
  LIVE_CLASSROOM_HISTORY_PATH,
  LIVE_CLASSROOM_REPORTS_PATH,
  LIVE_CLASSROOM_ROOT_PATH,
} from "@/lib/live-classroom-url";

function revalidateSessionAdminPaths(teamId: number, sessionId?: number) {
  revalidatePath(LIVE_CLASSROOM_ROOT_PATH);
  revalidatePath("/dashboard/live-classroom");
  revalidatePath(LIVE_CLASSROOM_HISTORY_PATH);
  revalidatePath(LIVE_CLASSROOM_REPORTS_PATH);
  if (sessionId != null) {
    revalidatePath(`/dashboard/live-classroom/session/${sessionId}`);
    revalidatePath(`/dashboard/live-classroom/session/${sessionId}/lobby`);
    revalidatePath(`/dashboard/live-classroom/reports/${sessionId}`);
  }
  void teamId;
}

/** Restart a session into an open lobby (owner / team admin). */
export async function restartLiveClassroomSessionAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
    requireOrgManage: true,
  });

  await returnLiveClassroomSessionToLobby(session.id, {
    survivalHearts: session.config.survivalHearts,
  });
  revalidateSessionAdminPaths(session.teamId, session.id);
  return { ok: true as const, sessionId: session.id };
}

/** Permanently delete a session (owner / team admin). */
export async function deleteLiveClassroomSessionAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
    requireOrgManage: true,
  });

  const teamId = session.teamId;
  const deleted = await deleteLiveClassroomSession(session.id);
  if (!deleted) throw new Error("Could not delete session.");

  revalidateSessionAdminPaths(teamId, sessionId);
  return { ok: true as const };
}
