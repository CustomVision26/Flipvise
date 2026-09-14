import "server-only";

import { cache } from "react";
import { getTeamsForTeamDashboard } from "@/db/queries/teams";
import { teamOwnsLiveClassroom } from "@/lib/live-classroom-access";
import { isLiveClassroomEligiblePlanSlug } from "@/lib/live-classroom-eligibility";
import type { TeamAdminAddonNavTeamSets } from "@/lib/team-admin-dashboard-nav";

/**
 * Workspaces where Team Admin should show Live Classroom™ — the organization
 * has a paid Stripe or assigned (admin) entitlement, and the workspace plan
 * can host that add-on.
 */
export const listTeamAdminAddonNavTeamSets = cache(
  async (userId: string): Promise<TeamAdminAddonNavTeamSets> => {
    const teams = await getTeamsForTeamDashboard(userId);

    const liveClassroomTeamIds: number[] = [];
    await Promise.all(
      teams.map(async (team) => {
        if (!isLiveClassroomEligiblePlanSlug(team.planSlug)) return;
        const ownership = await teamOwnsLiveClassroom(team.id);
        if (ownership.owns) liveClassroomTeamIds.push(team.id);
      }),
    );

    return {
      liveClassroomTeamIds,
      memberAddonTeamIds: [],
    };
  },
);
