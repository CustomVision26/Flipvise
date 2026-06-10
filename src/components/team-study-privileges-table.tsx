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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { teamAdminTableWrapClass } from "@/components/team-admin-panel-styles";
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
  const [draftByKey, setDraftByKey] = React.useState<Record<string, TeamMemberStudyPrivilege>>({});
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setWorkspaceId(String(defaultWorkspaceId));
  }, [defaultWorkspaceId]);

  const workspace = workspaces.find((w) => w.id === Number(workspaceId));

  const rows = React.useMemo(() => {
    if (!workspace) return [];
    const memberRoleByUserId = new Map(
      workspace.teamMembers.map((m) => [m.userId, m.role]),
    );
    return workspace.assignments
      .filter((a) => memberRoleByUserId.get(a.memberUserId) === "team_member")
      .map((a) => {
        const deck = workspace.decks.find((d) => d.id === a.deckId);
        const key = `${a.teamId}-${a.deckId}-${a.memberUserId}`;
        return {
          key,
          teamId: a.teamId,
          deckId: a.deckId,
          memberUserId: a.memberUserId,
          memberName: memberLabel(a.memberUserId, userFieldDisplayById[a.memberUserId]),
          deckName: deck?.name ?? `Deck #${a.deckId}`,
          studyPrivilege: a.studyPrivilege,
        };
      })
      .sort((a, b) => {
        const m = a.memberName.localeCompare(b.memberName);
        if (m !== 0) return m;
        return a.deckName.localeCompare(b.deckName);
      });
  }, [workspace, userFieldDisplayById]);

  function privilegeForRow(
    key: string,
    saved: TeamMemberStudyPrivilege,
  ): TeamMemberStudyPrivilege {
    return draftByKey[key] ?? saved;
  }

  async function onSaveRow(row: (typeof rows)[number]) {
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

  return (
    <div className="w-full max-w-4xl space-y-6">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="study-priv-workspace">Team workspace</Label>
        <Select
          value={workspaceId}
          onValueChange={(v) => v != null && setWorkspaceId(v)}
        >
          <SelectTrigger id="study-priv-workspace" className="h-10 w-full">
            <SelectValue placeholder="Choose a team workspace…" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((w) => (
              <SelectItem key={w.id} value={String(w.id)}>
                <span className="truncate">{w.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Regular team members only. Choose which study modes each member may use per assigned deck
          on the study page — Standard Review, Quiz, or both.
        </p>
        <div className={teamAdminTableWrapClass}>
          <Table className="min-w-[36rem] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Deck</TableHead>
                <TableHead>Study modes</TableHead>
                <TableHead className="w-[7rem] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No deck assignments for regular members in this workspace yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const draft = privilegeForRow(row.key, row.studyPrivilege);
                  const dirty = draft !== row.studyPrivilege;
                  return (
                    <TableRow key={row.key}>
                      <TableCell className="max-w-[12rem] font-medium">
                        <span className="truncate" title={row.memberName}>
                          {row.memberName}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[12rem]">
                        <span className="truncate" title={row.deckName}>
                          {row.deckName}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[14rem]">
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
                          <SelectTrigger className="h-9 w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TEAM_MEMBER_STUDY_PRIVILEGES.map((value) => (
                              <SelectItem key={value} value={value}>
                                {TEAM_MEMBER_STUDY_PRIVILEGE_LABELS[value]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          className="h-9"
                          disabled={!dirty || busyKey === row.key}
                          onClick={() => void onSaveRow(row)}
                        >
                          {busyKey === row.key ? "Saving…" : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
