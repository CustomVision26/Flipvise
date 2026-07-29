import {
  TEAM_ADMIN_ADDONS_PATH,
  buildTeamAdminAddonsPath,
} from "@/lib/team-admin-url";
import { loadTeamAdminPageContext } from "@/lib/load-team-admin-page-context";
import { TeamAdminToolPageLayout } from "@/components/team-admin-tool-page-layout";
import {
  TeamAdminAddonsPanel,
  type TeamAddonMemberRow,
} from "@/components/team-admin-addons-panel";
import { listTeamMembers } from "@/db/queries/teams";
import { listTeamMemberAddonKeys } from "@/db/queries/addons";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

interface PageProps {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    userid?: string;
    plan?: string;
  }>;
}

export default async function TeamAdminAddonsPage({ searchParams }: PageProps) {
  const ctx = await loadTeamAdminPageContext(buildTeamAdminAddonsPath, searchParams);
  const { selected } = ctx;

  const members = await listTeamMembers(selected.id);
  const userIds = [
    selected.ownerUserId,
    ...members.map((m) => m.userId),
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  const [displays, entitlements] = await Promise.all([
    getClerkUserFieldDisplaysByIds(userIds),
    listTeamMemberAddonKeys(userIds, AI_ESSAY_ADDON_KEY),
  ]);

  const rows: TeamAddonMemberRow[] = userIds.map((userId) => {
    const membership = members.find((m) => m.userId === userId);
    const ent = entitlements.get(userId) ?? null;
    const roleLabel =
      userId === selected.ownerUserId
        ? "Owner"
        : membership?.role === "team_admin"
          ? "Team Admin"
          : "Member";
    const display = displays[userId];
    return {
      userId,
      displayName: display?.primaryLine ?? userId,
      email: display?.primaryEmail ?? null,
      roleLabel,
      hasAiEssay: ent?.status === "active",
      entitlementSource:
        ent?.status === "active"
          ? (ent.source as "stripe" | "admin" | "team")
          : null,
    };
  });

  return (
    <TeamAdminToolPageLayout
      pathname={TEAM_ADMIN_ADDONS_PATH}
      ctx={ctx}
      legacyHeader={null}
    >
      <TeamAdminAddonsPanel teamId={selected.id} members={rows} />
    </TeamAdminToolPageLayout>
  );
}
