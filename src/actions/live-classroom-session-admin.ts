"use server";

import { revalidatePath } from "next/cache";
import { endLiveClassroomSessionAction } from "@/actions/live-classroom";
import {
  cancelLiveClassroomLobbySession,
  deleteLiveClassroomSession,
  getLiveClassroomSessionById,
  listActiveOrLobbySessionsForTeam,
  returnLiveClassroomSessionToLobby,
  updateLiveClassroomSession,
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

async function closeOtherOpenSessionsForTeam(
  teamId: number,
  keepSessionId: number,
): Promise<number> {
  const open = await listActiveOrLobbySessionsForTeam(teamId);
  let closed = 0;
  for (const other of open) {
    if (other.id === keepSessionId) continue;
    if (other.status === "lobby") {
      await cancelLiveClassroomLobbySession(other.id);
      closed += 1;
      continue;
    }
    if (other.status === "active" || other.status === "paused") {
      await endLiveClassroomSessionAction(other.id, { systemComplete: true });
      closed += 1;
    }
  }
  return closed;
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

  await closeOtherOpenSessionsForTeam(session.teamId, session.id);
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

/** Close a lobby/scheduled session without starting (owner / team admin). */
export async function cancelLiveClassroomLobbySessionAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
    requireOrgManage: true,
  });

  if (session.status !== "lobby" && session.status !== "scheduled") {
    throw new Error("Only lobby or scheduled sessions can be closed this way.");
  }

  const cancelled = await cancelLiveClassroomLobbySession(session.id);
  if (!cancelled) throw new Error("Could not close lobby.");

  revalidateSessionAdminPaths(session.teamId, sessionId);
  return { ok: true as const };
}

/**
 * Open a Sessions Pool row: close any other open lobby/live session first,
 * promote scheduled → lobby, then return the destination status.
 */
export async function openLiveClassroomSessionFromPoolAction(
  sessionId: number,
) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

  if (session.status === "completed" || session.status === "cancelled") {
    throw new Error("That session has already ended.");
  }

  const closedOther = await closeOtherOpenSessionsForTeam(
    session.teamId,
    session.id,
  );

  let status: "lobby" | "active" | "paused" | "scheduled" =
    session.status === "scheduled"
      ? "scheduled"
      : session.status === "active"
        ? "active"
        : session.status === "paused"
          ? "paused"
          : "lobby";

  if (status === "scheduled") {
    await updateLiveClassroomSession(session.id, { status: "lobby" });
    status = "lobby";
  }

  revalidateSessionAdminPaths(session.teamId, session.id);
  return {
    ok: true as const,
    sessionId: session.id,
    status,
    closedOther: closedOther > 0,
  };
}
