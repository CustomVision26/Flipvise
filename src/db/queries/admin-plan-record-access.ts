import { db } from "@/db";
import { teamMembers, teams } from "@/db/schema";
import { getTeamsByOwner, listTeamMembers } from "@/db/queries/teams";
import type { AdminOwnedWorkspaceRecord } from "@/db/queries/admin-user-records";
import { labelForEducationPlanSlug } from "@/lib/education-plans";
import {
  isMemberWithinMemberLimit,
  isTeamWithinWorkspaceLimit,
  selectNewestMembersWithinMemberLimit,
  selectNewestTeamsWithinWorkspaceLimit,
} from "@/lib/team-plan-limit-selection";
import { labelForTeamPlanSlug, limitsForPlan } from "@/lib/team-plans";
import { and, eq, inArray } from "drizzle-orm";

export type AdminPlanRecordLimits = {
  planSlug: string;
  planLabel: string;
  maxTeams: number;
  maxMembersPerTeam: number;
};

export function adminPlanRecordLimits(planSlug: string | null): AdminPlanRecordLimits {
  const slug = planSlug?.trim() || "free";
  const limits = limitsForPlan(slug);
  return {
    planSlug: slug,
    planLabel:
      labelForTeamPlanSlug(slug) ??
      labelForEducationPlanSlug(slug) ??
      (slug === "pro_plus" ? "Pro Plus" : slug === "pro" ? "Pro" : slug === "education_plus" ? "Education Plus" : "Free"),
    maxTeams: limits.maxTeams,
    maxMembersPerTeam: limits.maxMembersPerTeam,
  };
}

/** Checkbox state: newest rows still on, up to the current plan cap. */
export function markOwnedRecordsAllowed(
  workspaces: AdminOwnedWorkspaceRecord[],
  planSlug: string | null,
): AdminOwnedWorkspaceRecord[] {
  const limits = adminPlanRecordLimits(planSlug);
  const open = workspaces.filter((workspace) => workspace.inactiveAt == null);
  const allowedTeamIds = new Set(
    selectNewestTeamsWithinWorkspaceLimit(
      open.map((workspace) => ({
        id: workspace.teamId,
        createdAt: new Date(workspace.createdAt),
      })),
      limits.planSlug,
    ).map((workspace) => workspace.id),
  );

  return workspaces.map((workspace) => {
    const workspaceAllowed =
      limits.maxTeams > 0 &&
      workspace.inactiveAt == null &&
      allowedTeamIds.has(workspace.teamId);
    const openMembers = workspace.members.filter((member) => member.inactiveAt == null);
    const allowedMemberIds = new Set(
      selectNewestMembersWithinMemberLimit(
        openMembers.map((member) => ({
          userId: member.userId,
          createdAt: new Date(member.joinedAt),
        })),
        limits.planSlug,
      ).map((member) => member.userId),
    );
    return {
      ...workspace,
      allowed: workspaceAllowed,
      members: workspace.members.map((member) => ({
        ...member,
        allowed:
          workspaceAllowed &&
          limits.maxMembersPerTeam > 0 &&
          member.inactiveAt == null &&
          allowedMemberIds.has(member.userId),
      })),
    };
  });
}

/**
 * Turn a workspace off or on for the subscriber's current plan.
 * Turning one off keeps every other currently allowed workspace on, and
 * closes the rest, so a freed slot does not jump to the next newest row.
 */
export async function setOwnedWorkspaceActiveForPlan(input: {
  ownerUserId: string;
  teamId: number;
  active: boolean;
  planSlug: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const limits = adminPlanRecordLimits(input.planSlug);
  const owned = await getTeamsByOwner(input.ownerUserId, { includeInactive: true });
  const team = owned.find((row) => row.id === input.teamId);
  if (!team) return { ok: false, message: "This workspace does not belong to this subscriber." };

  if (!input.active) {
    const allowedIds = new Set(
      selectNewestTeamsWithinWorkspaceLimit(
        owned.filter((row) => row.inactiveAt == null),
        limits.planSlug,
      ).map((row) => row.id),
    );
    if (allowedIds.has(input.teamId)) allowedIds.delete(input.teamId);
    const closeIds = owned.filter((row) => !allowedIds.has(row.id)).map((row) => row.id);
    if (closeIds.length > 0) {
      await db
        .update(teams)
        .set({ inactiveAt: new Date() })
        .where(and(eq(teams.ownerUserId, input.ownerUserId), inArray(teams.id, closeIds)));
    }
    return { ok: true };
  }

  if (limits.maxTeams <= 0) {
    return {
      ok: false,
      message: `${limits.planLabel} does not include team workspaces.`,
    };
  }

  const openCount = owned.filter((row) => row.inactiveAt == null).length;
  const alreadyAllowed = isTeamWithinWorkspaceLimit(input.teamId, owned.filter((row) => row.inactiveAt == null), limits.planSlug);
  if (team.inactiveAt == null && alreadyAllowed) return { ok: true };
  if (team.inactiveAt == null || openCount >= limits.maxTeams) {
    return {
      ok: false,
      message: `${limits.planLabel} allows ${limits.maxTeams} workspaces. Turn off a checked workspace before turning this one on.`,
    };
  }

  await db
    .update(teams)
    .set({ inactiveAt: null })
    .where(and(eq(teams.id, input.teamId), eq(teams.ownerUserId, input.ownerUserId)));
  return { ok: true };
}

export async function setOwnedWorkspaceMemberActiveForPlan(input: {
  ownerUserId: string;
  teamId: number;
  memberUserId: string;
  active: boolean;
  planSlug: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const limits = adminPlanRecordLimits(input.planSlug);
  const owned = await getTeamsByOwner(input.ownerUserId, { includeInactive: true });
  const team = owned.find((row) => row.id === input.teamId);
  if (!team) return { ok: false, message: "This workspace does not belong to this subscriber." };

  const workspaceAllowed =
    limits.maxTeams > 0 &&
    team.inactiveAt == null &&
    isTeamWithinWorkspaceLimit(
      input.teamId,
      owned.filter((row) => row.inactiveAt == null),
      limits.planSlug,
    );
  if (!workspaceAllowed) {
    return {
      ok: false,
      message: "Turn this workspace on before changing its members.",
    };
  }

  const members = await listTeamMembers(input.teamId, { includeInactive: true });
  const member = members.find((row) => row.userId === input.memberUserId);
  if (!member) return { ok: false, message: "This member is not on the workspace." };

  if (!input.active) {
    const allowedIds = new Set(
      selectNewestMembersWithinMemberLimit(
        members.filter((row) => row.inactiveAt == null),
        limits.planSlug,
      ).map((row) => row.userId),
    );
    if (allowedIds.has(input.memberUserId)) allowedIds.delete(input.memberUserId);
    const closeIds = members.filter((row) => !allowedIds.has(row.userId)).map((row) => row.userId);
    if (closeIds.length > 0) {
      const now = new Date();
      await db
        .update(teamMembers)
        .set({ inactiveAt: now, updatedAt: now })
        .where(and(eq(teamMembers.teamId, input.teamId), inArray(teamMembers.userId, closeIds)));
    }
    return { ok: true };
  }

  if (limits.maxMembersPerTeam <= 0) {
    return {
      ok: false,
      message: `${limits.planLabel} does not include workspace members.`,
    };
  }

  const openCount = members.filter((row) => row.inactiveAt == null).length;
  const alreadyAllowed = isMemberWithinMemberLimit(
    input.memberUserId,
    members.filter((row) => row.inactiveAt == null),
    limits.planSlug,
  );
  if (member.inactiveAt == null && alreadyAllowed) return { ok: true };
  if (member.inactiveAt == null || openCount >= limits.maxMembersPerTeam) {
    return {
      ok: false,
      message: `${team.name} allows ${limits.maxMembersPerTeam} members on ${limits.planLabel}. Turn off a checked member before turning this one on.`,
    };
  }

  await db
    .update(teamMembers)
    .set({ inactiveAt: null, updatedAt: new Date() })
    .where(and(eq(teamMembers.teamId, input.teamId), eq(teamMembers.userId, input.memberUserId)));
  return { ok: true };
}
