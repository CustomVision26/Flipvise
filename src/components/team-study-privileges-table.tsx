"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TeamAdminRecordSlider } from "@/components/team-admin-record-slider";
import { updateDeckAssignmentStudyPrivilegeAction } from "@/actions/teams";
import type { TeamDeckAssignmentListRow } from "@/db/queries/teams";
import type { TeamMemberRow } from "@/db/schema";
import type { DeckRow } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import {
  TEAM_MEMBER_STUDY_PRIVILEGES,
  TEAM_MEMBER_STUDY_PRIVILEGE_LABELS,
  memberRoleQualifiesForStudyPrivileges,
  type TeamMemberStudyPrivilege,
} from "@/lib/team-study-privilege";

export type TeamStudyPrivilegeWorkspaceSnapshot = {
  id: number;
  name: string;
  planSlug: string;
  teamMembers: TeamMemberRow[];
  decks: DeckRow[];
  assignments: TeamDeckAssignmentListRow[];
};

export type TeamStudyPrivilegesTableProps = {
  workspaces: TeamStudyPrivilegeWorkspaceSnapshot[];
  defaultWorkspaceId: number;
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
};

type StudyPrivilegeRow = {
  key: string;
  teamId: number;
  deckId: number;
  memberUserId: string;
  memberLabel: string;
  memberRole: TeamMemberRow["role"];
  deckName: string;
  workspaceName: string;
  studyPrivilege: TeamMemberStudyPrivilege;
};

function memberLabel(
  userId: string,
  display: ClerkUserFieldDisplay | undefined,
): string {
  return display?.primaryLine ?? userId;
}

export function TeamStudyPrivilegesTable({
  workspaces,
  userFieldDisplayById,
}: TeamStudyPrivilegesTableProps) {
  const router = useRouter();
  const [activeRowKey, setActiveRowKey] = React.useState<string | null>(null);
  const [draftByKey, setDraftByKey] = React.useState<Record<string, TeamMemberStudyPrivilege>>({});
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const rows = React.useMemo((): StudyPrivilegeRow[] => {
    const out: StudyPrivilegeRow[] = [];
    for (const w of workspaces) {
      const memberRoleByUserId = new Map(w.teamMembers.map((m) => [m.userId, m.role]));
      for (const a of w.assignments) {
        const role = memberRoleByUserId.get(a.memberUserId);
        if (!role || !memberRoleQualifiesForStudyPrivileges(role, w.planSlug)) continue;
        const deck = w.decks.find((d) => d.id === a.deckId);
        out.push({
          key: `${a.teamId}-${a.deckId}-${a.memberUserId}`,
          teamId: a.teamId,
          deckId: a.deckId,
          memberUserId: a.memberUserId,
          memberLabel: memberLabel(a.memberUserId, userFieldDisplayById[a.memberUserId]),
          memberRole: role,
          deckName: deck?.name ?? `Deck #${a.deckId}`,
          workspaceName: w.name,
          studyPrivilege: a.studyPrivilege,
        });
      }
    }
    out.sort((a, b) => {
      const ws = a.workspaceName.localeCompare(b.workspaceName);
      if (ws !== 0) return ws;
      const m = a.memberLabel.localeCompare(b.memberLabel);
      if (m !== 0) return m;
      return a.deckName.localeCompare(b.deckName);
    });
    return out;
  }, [workspaces, userFieldDisplayById]);

  function onPrivilegeRowActivate(row: StudyPrivilegeRow) {
    setActiveRowKey((prev) => (prev === row.key ? null : row.key));
    setError(null);
  }

  const deckFilterOptions = React.useMemo(
    () => [...new Set(rows.map((r) => r.deckName))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  function privilegeSearchHaystack(row: StudyPrivilegeRow): string {
    const display = userFieldDisplayById[row.memberUserId];
    return [
      row.memberLabel,
      row.deckName,
      row.workspaceName,
      display?.primaryEmail,
      display?.secondaryLine,
      row.memberUserId,
    ]
      .filter((part): part is string => Boolean(part && String(part).trim()))
      .join(" ");
  }

  function privilegeForRow(
    key: string,
    saved: TeamMemberStudyPrivilege,
  ): TeamMemberStudyPrivilege {
    return draftByKey[key] ?? saved;
  }

  async function onSaveRow(row: StudyPrivilegeRow) {
    const next = privilegeForRow(row.key, row.studyPrivilege);
    if (next === row.studyPrivilege) return;
    setError(null);
    setBusyKey(row.key);
    try {
      await updateDeckAssignmentStudyPrivilegeAction({
        teamId: row.teamId,
        deckId: row.deckId,
        memberUserId: row.memberUserId,
        studyPrivilege: next,
      });
      setDraftByKey((prev) => {
        const copy = { ...prev };
        delete copy[row.key];
        return copy;
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusyKey(null);
    }
  }

  if (workspaces.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No team workspaces available for study privileges.
      </p>
    );
  }

  function renderPrivilegeControls(row: StudyPrivilegeRow) {
    const draft = privilegeForRow(row.key, row.studyPrivilege);
    const dirty = draft !== row.studyPrivilege;

    return (
      <>
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Study modes
          </Label>
          <Select
            value={draft}
            onValueChange={(v) => {
              if (v == null) return;
              setDraftByKey((prev) => ({
                ...prev,
                [row.key]: v as TeamMemberStudyPrivilege,
              }));
            }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue>
                {(value) =>
                  value
                    ? TEAM_MEMBER_STUDY_PRIVILEGE_LABELS[value as TeamMemberStudyPrivilege]
                    : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TEAM_MEMBER_STUDY_PRIVILEGES.map((value) => (
                <SelectItem key={value} value={value}>
                  {TEAM_MEMBER_STUDY_PRIVILEGE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-10 w-full sm:w-auto"
          disabled={!dirty || busyKey === row.key}
          onClick={() => void onSaveRow(row)}
        >
          {busyKey === row.key ? "Saving…" : "Save changes"}
        </Button>
      </>
    );
  }

  function renderOpenPanel(row: StudyPrivilegeRow) {
    const display = userFieldDisplayById[row.memberUserId];
    const grantedAccess = TEAM_MEMBER_STUDY_PRIVILEGE_LABELS[
      privilegeForRow(row.key, row.studyPrivilege)
    ];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Member
            </p>
            <p className="font-medium text-foreground">{row.memberLabel}</p>
            {display?.primaryEmail ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {display.primaryEmail}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {row.memberRole === "team_admin" ? "Team admin" : "Team member"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Deck
            </p>
            <p className="text-sm text-foreground">{row.deckName}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Workspace
            </p>
            <p className="text-sm text-foreground">{row.workspaceName}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Access granted
            </p>
            <p className="text-sm font-medium text-foreground">{grantedAccess}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {renderPrivilegeControls(row)}
        </div>
      </div>
    );
  }

  const tableColumns = React.useMemo(
    () => [
      {
        id: "member",
        header: "Member",
        className: "min-w-[10rem]",
        cell: (row: StudyPrivilegeRow) => {
          const display = userFieldDisplayById[row.memberUserId];
          return (
            <div className="min-w-0">
              <p className="font-medium text-foreground">{row.memberLabel}</p>
              {display?.primaryEmail ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {display.primaryEmail}
                </p>
              ) : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.memberRole === "team_admin" ? "Team admin" : "Team member"}
              </p>
            </div>
          );
        },
      },
      {
        id: "deck",
        header: "Deck",
        className: "min-w-[8rem]",
        cell: (row: StudyPrivilegeRow) => (
          <span className="text-sm text-foreground">{row.deckName}</span>
        ),
      },
      {
        id: "workspace",
        header: "Workspace",
        className: "min-w-[8rem]",
        cell: (row: StudyPrivilegeRow) => (
          <span className="text-sm text-foreground">{row.workspaceName}</span>
        ),
      },
      {
        id: "access",
        header: "Access granted",
        className: "min-w-[10rem]",
        cell: (row: StudyPrivilegeRow) => (
          <span className="text-sm text-foreground">
            {
              TEAM_MEMBER_STUDY_PRIVILEGE_LABELS[
                privilegeForRow(row.key, row.studyPrivilege)
              ]
            }
          </span>
        ),
      },
    ],
    [userFieldDisplayById, draftByKey],
  );

  return (
    <div className="w-full max-w-4xl space-y-6">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          All member and deck assignments across your workspaces. Click a row to open study modes
          for that assignment.
        </p>
        <TeamAdminRecordSlider
          items={rows}
          activeKey={activeRowKey}
          onActivate={onPrivilegeRowActivate}
          layout="table"
          tableGroupByMember
          tablePageSize={10}
          tableColumns={tableColumns}
          deckFilterOptions={deckFilterOptions}
          getSearchHaystack={privilegeSearchHaystack}
          emptyMessage="No deck assignments eligible for study mode controls yet."
          noResultsMessage="No assignments match your search or filters."
          renderBelowActive={(row) =>
            activeRowKey === row.key ? renderOpenPanel(row) : null
          }
        />
      </div>
    </div>
  );
}
