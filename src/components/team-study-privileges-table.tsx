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

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";
import { updateDeckAssignmentStudyPrivilegeAction } from "@/actions/teams";
import type { TeamDeckAssignmentListRow } from "@/db/queries/teams";
import type { TeamMemberRow } from "@/db/schema";
import type { DeckRow } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import {
  TEAM_MEMBER_STUDY_PRIVILEGES,
  TEAM_MEMBER_STUDY_PRIVILEGE_LABELS,
  type TeamMemberStudyPrivilege,
} from "@/lib/team-study-privilege";

export type TeamStudyPrivilegeWorkspaceSnapshot = {
  id: number;
  name: string;
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
  defaultWorkspaceId,
  userFieldDisplayById,
}: TeamStudyPrivilegesTableProps) {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = React.useState(String(defaultWorkspaceId));
  const [workspaceLocked, setWorkspaceLocked] = React.useState(false);
  const [activeRowKey, setActiveRowKey] = React.useState<string | null>(null);
  const [draftByKey, setDraftByKey] = React.useState<Record<string, TeamMemberStudyPrivilege>>({});
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workspaceLocked) {
      setWorkspaceId(String(defaultWorkspaceId));
    }
  }, [defaultWorkspaceId, workspaceLocked]);

  const workspace = workspaces.find((w) => w.id === Number(workspaceId));

  const rows = React.useMemo((): StudyPrivilegeRow[] => {
    const out: StudyPrivilegeRow[] = [];
    for (const w of workspaces) {
      const memberRoleByUserId = new Map(w.teamMembers.map((m) => [m.userId, m.role]));
      for (const a of w.assignments) {
        if (memberRoleByUserId.get(a.memberUserId) !== "team_member") continue;
        const deck = w.decks.find((d) => d.id === a.deckId);
        out.push({
          key: `${a.teamId}-${a.deckId}-${a.memberUserId}`,
          teamId: a.teamId,
          deckId: a.deckId,
          memberUserId: a.memberUserId,
          memberLabel: memberLabel(a.memberUserId, userFieldDisplayById[a.memberUserId]),
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

  function onPrivilegeRowDoubleClick(row: StudyPrivilegeRow) {
    setWorkspaceId(String(row.teamId));
    setWorkspaceLocked(true);
    setActiveRowKey(row.key);
    setError(null);
  }

  function unlockWorkspaceField() {
    setWorkspaceLocked(false);
    setActiveRowKey(null);
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

  return (
    <div className="w-full max-w-4xl space-y-6">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Regular team members only. Set which study modes each member may use per assigned deck —
          Standard Review, Quiz, or both. Swipe or use the arrows to browse assignments. Double-click a
          record to load its workspace in Search &amp; filters.
        </p>

        <TeamAdminRecordSlider
          items={rows}
          activeKey={activeRowKey ?? workspaceId}
          interactiveCard
          onDoubleClick={onPrivilegeRowDoubleClick}
          deckFilterOptions={deckFilterOptions}
          getSearchHaystack={privilegeSearchHaystack}
          filterPanelExtraActive={workspaceLocked}
          filterPanelExtra={({ filtersOpen }) => (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label
                  htmlFor="study-priv-workspace"
                  className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Team workspace
                </Label>
                {workspaceLocked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={unlockWorkspaceField}
                  >
                    Change workspace
                  </Button>
                ) : null}
              </div>
              <Select
                value={workspaceId}
                disabled={workspaceLocked || !filtersOpen}
                onValueChange={(v) => {
                  if (workspaceLocked || v == null) return;
                  setWorkspaceId(v);
                  setActiveRowKey(v);
                }}
              >
                <SelectTrigger
                  id="study-priv-workspace"
                  className="h-10 w-full bg-background disabled:cursor-default disabled:opacity-100"
                >
                  <SelectValue placeholder={PLACEHOLDER_WORKSPACE}>
                    {workspace?.name ?? PLACEHOLDER_WORKSPACE}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      <span className="truncate">{w.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workspaceLocked && workspace ? (
                <p className="text-xs text-muted-foreground">
                  Set from the selected assignment. Double-click another record to switch workspace.
                </p>
              ) : null}
            </div>
          )}
          emptyMessage="No deck assignments for regular members yet."
          noResultsMessage="No assignments match your search or filters."
          renderCard={(row) => {
            const display = userFieldDisplayById[row.memberUserId];
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
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  {renderPrivilegeControls(row)}
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
