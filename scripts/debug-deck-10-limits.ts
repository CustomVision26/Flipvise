import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

import { db } from "../src/db";
import { teams, teamMembers } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { getTeamsByOwner, listTeamMembers } from "../src/db/queries/teams";
import {
  isTeamWithinWorkspaceLimit,
  isMemberWithinMemberLimit,
  teamIdsWithinWorkspaceLimit,
  memberUserIdsWithinMemberLimit,
} from "../src/lib/team-plan-limit-selection";

const ownerId = "user_3CY2tvm7kHof7ymwDn9sxwJFW0j";
const memberId = "user_3CL3VVo19GBtTo00XJvygYddloT";

async function main() {
  const owned = await getTeamsByOwner(ownerId);
  console.log(
    "owned teams",
    owned.map((t) => ({ id: t.id, name: t.name, plan: t.planSlug, created: t.createdAt })),
  );

  for (const plan of [...new Set(owned.map((t) => t.planSlug))]) {
    console.log("within workspace ids for plan", plan, [
      ...teamIdsWithinWorkspaceLimit(owned, plan),
    ]);
  }

  for (const teamId of [3, 5]) {
    const team = owned.find((t) => t.id === teamId);
    if (!team) {
      console.log("team", teamId, "not owned by subscriber");
      continue;
    }
    const members = await listTeamMembers(teamId);
    const wsOk = isTeamWithinWorkspaceLimit(teamId, owned, team.planSlug);
    const memOk = isMemberWithinMemberLimit(memberId, members, team.planSlug);
    console.log(`team ${teamId}`, {
      plan: team.planSlug,
      workspaceOk: wsOk,
      memberOk: memOk,
      members: members.map((m) => ({ userId: m.userId.slice(-8), created: m.createdAt })),
      allowedMembers: [...memberUserIdsWithinMemberLimit(members, team.planSlug)],
    });
  }
}

main().catch(console.error);
