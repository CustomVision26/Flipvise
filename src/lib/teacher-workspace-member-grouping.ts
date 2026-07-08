export type WorkspaceMemberMeta = {
  role: "team_admin" | "team_member";
  addedByUserId: string | null;
  addedByAsOwner: boolean | null;
  name: string | null;
  email: string | null;
};

export function resolveLeaderUserId(
  memberUserId: string,
  ownerUserId: string,
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>,
): string {
  const meta = memberMetaByUserId[memberUserId];
  if (!meta) return ownerUserId;

  const addedBy = meta.addedByUserId;
  if (!addedBy) return ownerUserId;
  if (addedBy === ownerUserId || meta.addedByAsOwner) return ownerUserId;

  const adderMeta = memberMetaByUserId[addedBy];
  if (adderMeta?.role === "team_admin") return addedBy;

  return ownerUserId;
}

export function resolveCreatorLeader(
  creatorUserId: string,
  ownerUserId: string,
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>,
): { leaderUserId: string; leaderRole: "owner" | "team_admin" } {
  if (creatorUserId === ownerUserId) {
    return { leaderUserId: ownerUserId, leaderRole: "owner" };
  }

  const meta = memberMetaByUserId[creatorUserId];
  if (meta?.role === "team_admin") {
    return { leaderUserId: creatorUserId, leaderRole: "team_admin" };
  }

  const leaderUserId = resolveLeaderUserId(
    creatorUserId,
    ownerUserId,
    memberMetaByUserId,
  );

  return {
    leaderUserId,
    leaderRole: leaderUserId === ownerUserId ? "owner" : "team_admin",
  };
}

export type AdminLedSubjectGroup<T extends { subject: string }> = {
  leaderUserId: string;
  leaderLabel: string;
  leaderRole: "owner" | "team_admin";
  subjectGroups: Array<{ subject: string; items: T[] }>;
  itemCount: number;
};

export type MemberItemGroup<T> = {
  memberUserId: string;
  memberLabel: string;
  memberRole: "owner" | "team_admin" | "team_member" | null;
  items: T[];
};

export type AdminLedMemberGroup<T> = {
  leaderUserId: string;
  leaderLabel: string;
  leaderRole: "owner" | "team_admin";
  leaderItems: T[];
  memberGroups: MemberItemGroup<T>[];
  itemCount: number;
};

export function buildAdminLedMemberGroups<T>(
  items: T[],
  getCreatorUserId: (item: T) => string,
  getMemberRole: (userId: string) => "owner" | "team_admin" | "team_member" | null,
  getMemberLabel: (
    userId: string,
    role: "owner" | "team_admin" | "team_member" | null,
  ) => string,
  ownerUserId: string,
  ownerName: string | null,
  ownerEmail: string | null,
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>,
): AdminLedMemberGroup<T>[] {
  const memberBuckets = new Map<
    string,
    {
      memberUserId: string;
      memberLabel: string;
      memberRole: "owner" | "team_admin" | "team_member" | null;
      items: T[];
    }
  >();

  for (const item of items) {
    const memberUserId = getCreatorUserId(item);
    const memberRole = getMemberRole(memberUserId);
    const memberLabel = getMemberLabel(memberUserId, memberRole);
    const existing = memberBuckets.get(memberUserId);
    if (existing) {
      existing.items.push(item);
    } else {
      memberBuckets.set(memberUserId, {
        memberUserId,
        memberLabel,
        memberRole,
        items: [item],
      });
    }
  }

  const adminMap = new Map<string, AdminLedMemberGroup<T>>();

  function ensureAdmin(
    leaderUserId: string,
    leaderRole: "owner" | "team_admin",
  ): AdminLedMemberGroup<T> {
    const existing = adminMap.get(leaderUserId);
    if (existing) return existing;

    const leaderLabel =
      leaderRole === "owner"
        ? ownerName ?? ownerEmail ?? "Workspace owner"
        : memberMetaByUserId[leaderUserId]?.name ??
          memberMetaByUserId[leaderUserId]?.email ??
          "Team admin";

    const group: AdminLedMemberGroup<T> = {
      leaderUserId,
      leaderLabel,
      leaderRole,
      leaderItems: [],
      memberGroups: [],
      itemCount: 0,
    };
    adminMap.set(leaderUserId, group);
    return group;
  }

  for (const memberGroup of memberBuckets.values()) {
    const role = memberGroup.memberRole;

    if (role === "owner") {
      const adminGroup = ensureAdmin(ownerUserId, "owner");
      adminGroup.leaderItems.push(...memberGroup.items);
      continue;
    }

    if (role === "team_admin") {
      const adminGroup = ensureAdmin(memberGroup.memberUserId, "team_admin");
      adminGroup.leaderItems.push(...memberGroup.items);
      continue;
    }

    const leaderUserId = resolveLeaderUserId(
      memberGroup.memberUserId,
      ownerUserId,
      memberMetaByUserId,
    );
    const leaderRole = leaderUserId === ownerUserId ? "owner" : "team_admin";
    const adminGroup = ensureAdmin(leaderUserId, leaderRole);
    adminGroup.memberGroups.push(memberGroup);
  }

  return [...adminMap.values()]
    .map((group) => ({
      ...group,
      memberGroups: [...group.memberGroups].sort((a, b) =>
        a.memberLabel.localeCompare(b.memberLabel),
      ),
      itemCount:
        group.leaderItems.length +
        group.memberGroups.reduce((sum, member) => sum + member.items.length, 0),
    }))
    .filter((group) => group.itemCount > 0)
    .sort((a, b) => {
      if (a.leaderRole === "owner" && b.leaderRole !== "owner") return -1;
      if (b.leaderRole === "owner" && a.leaderRole !== "owner") return 1;
      return a.leaderLabel.localeCompare(b.leaderLabel);
    });
}

export function buildAdminLedSubjectGroups<T extends { subject: string; creatorUserId: string }>(
  items: T[],
  ownerUserId: string,
  ownerName: string | null,
  ownerEmail: string | null,
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>,
  leaderLabelFor: (leaderUserId: string, leaderRole: "owner" | "team_admin") => string,
): AdminLedSubjectGroup<T>[] {
  const adminBuckets = new Map<string, T[]>();

  for (const item of items) {
    const { leaderUserId } = resolveCreatorLeader(
      item.creatorUserId,
      ownerUserId,
      memberMetaByUserId,
    );
    const bucket = adminBuckets.get(leaderUserId) ?? [];
    bucket.push(item);
    adminBuckets.set(leaderUserId, bucket);
  }

  const groups: AdminLedSubjectGroup<T>[] = [];

  for (const [leaderUserId, adminItems] of adminBuckets) {
    const leaderRole = leaderUserId === ownerUserId ? "owner" : "team_admin";
    const subjectMap = new Map<string, T[]>();

    for (const item of adminItems) {
      const subject = item.subject.trim() || "Other";
      const list = subjectMap.get(subject) ?? [];
      list.push(item);
      subjectMap.set(subject, list);
    }

    const subjectGroups = [...subjectMap.entries()]
      .map(([subject, subjectItems]) => ({ subject, items: subjectItems }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    groups.push({
      leaderUserId,
      leaderLabel: leaderLabelFor(leaderUserId, leaderRole),
      leaderRole,
      subjectGroups,
      itemCount: adminItems.length,
    });
  }

  return groups
    .filter((group) => group.itemCount > 0)
    .sort((a, b) => {
      if (a.leaderRole === "owner" && b.leaderRole !== "owner") return -1;
      if (b.leaderRole === "owner" && a.leaderRole !== "owner") return 1;
      return a.leaderLabel.localeCompare(b.leaderLabel);
    });
}
