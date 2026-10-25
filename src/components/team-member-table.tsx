"use client";

import * as React from "react";
import { MoreHorizontal, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TeamMemberRow } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { canManageMemberAsOwnerOrInviter } from "@/lib/team-member-inviter-access";

type MemberRow = TeamMemberRow;

type MemberDetailTarget =
  | { kind: "owner" }
  | { kind: "member"; member: MemberRow };

interface TeamMemberTableProps {
  teamId: number;
  teamName: string;
  deckNamesByMemberUserId: Record<string, string[]>;
  workspaceDeckNames: string[];
  ownerUserId: string;
  /** Workspace `teams.createdAt` — for the owner row, not a `team_members` row. */
  teamCreatedAt: Date;
  members: MemberRow[];
  currentUserId: string;
  isOwner: boolean;
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
  showRosterHeader?: boolean;
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

function emailForDisplay(
  userId: string,
  display: ClerkUserFieldDisplay | undefined,
): string | null {
  const fromPrimary = display?.primaryEmail?.trim();
  if (fromPrimary) return fromPrimary;
  return emailFromClerkSecondLine(display?.secondaryLine ?? null);
}

function roleLabel(role: "team_admin" | "team_member" | "owner") {
  if (role === "owner") return "Owner (subscriber)";
  if (role === "team_admin") return "Team admin";
  return "Member";
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  );
}

function DeckList({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <span className="text-muted-foreground">None assigned yet</span>;
  }
  return (
    <ul className="list-inside list-disc space-y-0.5">
      {names.map((name) => (
        <li key={name} className="text-sm">
          {name}
        </li>
      ))}
    </ul>
  );
}

const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-amber-100 text-amber-800",
  "bg-emerald-100 text-emerald-700",
];

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

function avatarTone(name: string) {
  let total = 0;
  for (const char of name) total += char.charCodeAt(0);
  return AVATAR_TONES[total % AVATAR_TONES.length];
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
    <div className="flex min-w-0 max-w-[min(100%,280px)] items-center gap-3">
      <Avatar>
        <AvatarFallback className={avatarTone(primary)}>{initialsFor(primary)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-900" title={primary}>
          {primary}
        </div>
        {secondary ? (
          <div className="truncate text-xs text-slate-500" title={secondary}>
            {secondary}
          </div>
        ) : showUserIdSubline ? (
          <div className="truncate font-mono text-[11px] text-slate-500" title={userId}>
            {userId}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TeamMemberTable({
  teamId,
  teamName,
  deckNamesByMemberUserId,
  workspaceDeckNames,
  ownerUserId,
  teamCreatedAt,
  members,
  currentUserId,
  isOwner,
  userFieldDisplayById,
  showRosterHeader = false,
}: TeamMemberTableProps) {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [removeDialogUserId, setRemoveDialogUserId] = React.useState<string | null>(null);
  const [removeSaving, setRemoveSaving] = React.useState(false);
  const [detailTarget, setDetailTarget] = React.useState<MemberDetailTarget | null>(null);
  const [query, setQuery] = React.useState("");
  /** Stable id for confirm action — dialog close can clear state before the server call finishes. */
  const removeTargetUserIdRef = React.useRef<string | null>(null);

  function openDetailFromRow(
    target: MemberDetailTarget,
    e: React.MouseEvent<HTMLTableRowElement>,
  ) {
    if ((e.target as HTMLElement).closest("button, a, [data-slot=select-trigger]")) {
      return;
    }
    setDetailTarget(target);
  }

  const detailUserId =
    detailTarget?.kind === "owner"
      ? ownerUserId
      : detailTarget?.kind === "member"
        ? detailTarget.member.userId
        : null;
  const detailDisplay =
    detailUserId != null ? userFieldDisplayById[detailUserId] : undefined;
  const detailName = detailDisplay?.primaryLine?.trim() || detailUserId || "—";
  const detailEmail = detailUserId
    ? emailForDisplay(detailUserId, detailDisplay)
    : null;
  const detailAcceptedAt =
    detailTarget?.kind === "owner"
      ? teamCreatedAt
      : detailTarget?.kind === "member"
        ? detailTarget.member.createdAt
        : null;
  const detailRole =
    detailTarget?.kind === "owner"
      ? "owner"
      : detailTarget?.kind === "member"
        ? detailTarget.member.role
        : null;
  const detailDecks =
    detailTarget?.kind === "owner"
      ? workspaceDeckNames
      : detailTarget?.kind === "member"
        ? (deckNamesByMemberUserId[detailTarget.member.userId] ?? [])
        : [];

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

  const needle = query.trim().toLowerCase();
  function rowMatches(userId: string) {
    if (!needle) return true;
    const display = userFieldDisplayById[userId];
    const haystack = [display?.primaryLine, display?.secondaryLine, display?.primaryEmail, userId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  }
  const ownerVisible = rowMatches(ownerUserId);
  const visibleMembers = members.filter((member) => rowMatches(member.userId));

  return (
    <div className="space-y-3">
      {showRosterHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Users className="size-5 text-violet-600" aria-hidden />
            Members roster
          </h2>
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members..."
              aria-label="Search members"
              className="bg-white pl-8 text-slate-900"
            />
          </div>
        </div>
      ) : null}
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
            {ownerVisible ? (
            <TableRow
              className="cursor-pointer"
              onDoubleClick={(e) => openDetailFromRow({ kind: "owner" }, e)}
              title="Double-click for details"
            >
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
            ) : null}
            {!ownerVisible && visibleMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-slate-500">
                  No members match that search.
                </TableCell>
              </TableRow>
            ) : null}
            {visibleMembers.map((m) => {
              const canManageThisMember = canManageMemberAsOwnerOrInviter({
                viewerUserId: currentUserId,
                ownerUserId,
                memberUserId: m.userId,
                addedByUserId: m.addedByUserId,
              });
              const manageHint = canManageThisMember
                ? undefined
                : isOwner
                  ? undefined
                  : "You can only update or remove members you invited.";
              return (
                <TableRow
                  key={m.id}
                  className="cursor-pointer"
                  onDoubleClick={(e) => openDetailFromRow({ kind: "member", member: m }, e)}
                  title="Double-click for details"
                >
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
                      disabled={busy === m.userId || !canManageThisMember}
                    >
                      <SelectTrigger className="h-8 w-[160px] rounded-lg border-stone-200 bg-white text-slate-900" title={manageHint}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team_member">Member</SelectItem>
                        <SelectItem value="team_admin">Team admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={(menuProps) => (
                          <Button
                            {...menuProps}
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            className="border-stone-200 bg-white text-slate-700"
                            disabled={busy === m.userId || !canManageThisMember}
                            title={manageHint ?? "Member actions"}
                            aria-label={`Actions for ${userFieldDisplayById[m.userId]?.primaryLine ?? "member"}`}
                          >
                            <MoreHorizontal className="size-4" aria-hidden />
                          </Button>
                        )}
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={busy === m.userId || !canManageThisMember}
                          onClick={() => {
                            setError(null);
                            removeTargetUserIdRef.current = m.userId;
                            setRemoveDialogUserId(m.userId);
                          }}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={detailTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Member details</DialogTitle>
            <DialogDescription>
              Workspace membership and deck assignments for {teamName}.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-4">
            <DetailField label="Name">{detailName}</DetailField>
            <DetailField label="Email">
              {detailEmail ?? <span className="text-muted-foreground">—</span>}
            </DetailField>
            <DetailField label="Acceptance date">
              {detailAcceptedAt
                ? formatMemberTimestamp(detailAcceptedAt)
                : "—"}
            </DetailField>
            <DetailField label="Role">
              {detailRole ? roleLabel(detailRole) : "—"}
            </DetailField>
            <DetailField label="Workspace">{teamName}</DetailField>
            <DetailField
              label={
                detailTarget?.kind === "owner"
                  ? "Decks in workspace"
                  : "Decks assigned to user"
              }
            >
              <DeckList names={detailDecks} />
            </DetailField>
          </dl>
        </DialogContent>
      </Dialog>

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
