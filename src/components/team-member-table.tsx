"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  removeTeamMemberAction,
  updateTeamMemberRoleAction,
} from "@/actions/teams";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { InferSelectModel } from "drizzle-orm";
import { teamMembers } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";

type MemberRow = InferSelectModel<typeof teamMembers>;

interface TeamMemberTableProps {
  teamId: number;
  ownerUserId: string;
  /** Workspace `teams.createdAt` — for the owner row, not a `team_members` row. */
  teamCreatedAt: Date;
  members: MemberRow[];
  currentUserId: string;
  isOwner: boolean;
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
}

function formatMemberTimestamp(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const EMAILISH = /^[^\s@]+@[^\s@]+\.[^\s@]+/i;

function emailFromClerkSecondLine(secondaryLine: string | null | undefined) {
  if (!secondaryLine?.trim()) return null;
  const s = secondaryLine.trim();
  if (s.includes("·")) {
    for (const part of s.split("·").map((p) => p.trim())) {
      const t = part.replace(/^@+/, "");
      if (EMAILISH.test(t)) return t;
    }
  }
  if (EMAILISH.test(s)) return s;
  return null;
}

function InvitedByCell({
  userId,
  display,
  addedByAsOwner,
}: {
  userId: string;
  display: ClerkUserFieldDisplay | undefined;
  addedByAsOwner: boolean | null;
}) {
  const name = (display?.primaryLine?.trim() || userId);
  const email =
    display?.primaryEmail?.trim() ||
    emailFromClerkSecondLine(display?.secondaryLine ?? null);
  return (
    <div className="min-w-0 max-w-[min(100%,260px)]">
      <div className="truncate font-medium text-foreground" title={name}>
        {name}
      </div>
      {email ? (
        <div className="truncate text-xs text-muted-foreground" title={email}>
          {email}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">—</div>
      )}
      {addedByAsOwner != null && (
        <div className="mt-0.5 text-[11px] text-muted-foreground/90">
          {addedByAsOwner ? "Workspace owner" : "Team admin"}
        </div>
      )}
    </div>
  );
}

function UserCell({
  userId,
  display,
}: {
  userId: string;
  display: ClerkUserFieldDisplay | undefined;
}) {
  const primary = display?.primaryLine ?? userId;
  const secondary = display?.secondaryLine;
  const showUserIdSubline = !secondary && primary !== userId;
  return (
    <div className="min-w-0 max-w-[min(100%,280px)]">
      <div className="truncate font-medium text-foreground" title={primary}>
        {primary}
      </div>
      {secondary ? (
        <div
          className="truncate text-xs text-muted-foreground"
          title={secondary}
        >
          {secondary}
        </div>
      ) : showUserIdSubline ? (
        <div
          className="truncate font-mono text-[11px] text-muted-foreground/80"
          title={userId}
        >
          {userId}
        </div>
      ) : null}
    </div>
  );
}

export function TeamMemberTable({
  teamId,
  ownerUserId,
  teamCreatedAt,
  members,
  currentUserId,
  isOwner,
  userFieldDisplayById,
}: TeamMemberTableProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [removeDialogUserId, setRemoveDialogUserId] = React.useState<string | null>(null);
  const [removeSaving, setRemoveSaving] = React.useState(false);
  /** Stable id for confirm action — dialog close can clear state before the server call finishes. */
  const removeTargetUserIdRef = React.useRef<string | null>(null);

  async function onRoleChange(memberUserId: string, role: "team_admin" | "team_member") {
    setError(null);
    setBusy(memberUserId);
    try {
      await updateTeamMemberRoleAction({ teamId, memberUserId, role });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setBusy(null);
    }
  }

  async function confirmRemoveMember() {
    const memberUserId = removeTargetUserIdRef.current;
    if (!memberUserId) return;
    setError(null);
    setRemoveSaving(true);
    setBusy(memberUserId);
    try {
      await removeTeamMemberAction({ teamId, memberUserId });
      removeTargetUserIdRef.current = null;
      setRemoveDialogUserId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setBusy(null);
      setRemoveSaving(false);
    }
  }

  const removeTargetDisplay =
    removeDialogUserId != null
      ? (userFieldDisplayById[removeDialogUserId]?.primaryLine ?? removeDialogUserId)
      : null;

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-x-auto -mx-1 px-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead className="whitespace-nowrap">Created</TableHead>
              <TableHead className="whitespace-nowrap">Updated</TableHead>
              <TableHead>Added by (inviter)</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <UserCell
                  userId={ownerUserId}
                  display={userFieldDisplayById[ownerUserId]}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                {formatMemberTimestamp(teamCreatedAt)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">—</TableCell>
              <TableCell className="text-muted-foreground text-sm">—</TableCell>
              <TableCell>Owner (subscriber)</TableCell>
              <TableCell className="text-end text-muted-foreground text-xs">—</TableCell>
            </TableRow>
            {members.map((m) => {
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <UserCell
                      userId={m.userId}
                      display={userFieldDisplayById[m.userId]}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {formatMemberTimestamp(m.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                    {formatMemberTimestamp(m.updatedAt)}
                  </TableCell>
                  <TableCell>
                    {m.addedByUserId ? (
                      <InvitedByCell
                        userId={m.addedByUserId}
                        display={userFieldDisplayById[m.addedByUserId]}
                        addedByAsOwner={m.addedByAsOwner}
                      />
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <span>—</span>
                        <div className="text-xs">Not recorded</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        onRoleChange(m.userId, v as "team_admin" | "team_member")
                      }
                      disabled={
                        busy === m.userId ||
                        m.userId === currentUserId ||
                        (!isOwner && m.role === "team_admin")
                      }
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team_member">Member</SelectItem>
                        <SelectItem value="team_admin">Team admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        busy === m.userId ||
                        m.userId === currentUserId ||
                        m.userId === ownerUserId
                      }
                      onClick={() => {
                        setError(null);
                        removeTargetUserIdRef.current = m.userId;
                        setRemoveDialogUserId(m.userId);
                      }}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={removeDialogUserId !== null}
        onOpenChange={(open) => {
          if (!open) {
            removeTargetUserIdRef.current = null;
            setRemoveDialogUserId(null);
          }
        }}
      >
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">
              Remove this member from the team?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              {removeTargetDisplay ? (
                <>
                  <span className="font-medium text-foreground">{removeTargetDisplay}</span> will
                  lose access to this workspace. Any deck assignments for them here should be
                  updated separately. This cannot be undone from the member{"'"}s side.
                </>
              ) : (
                "This member will lose access to this workspace. This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto" disabled={removeSaving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={removeSaving}
              onClick={() => void confirmRemoveMember()}
            >
              {removeSaving ? "Removing…" : "Remove member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
