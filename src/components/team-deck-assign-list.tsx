"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { cn } from "@/lib/utils";
import { TeamAdminRecordSlider } from "@/components/team-admin-record-slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignDeckToMemberAction,
  unassignDeckFromMemberAction,
  linkPersonalDeckToTeamWorkspaceAction,
  unlinkPersonalDeckFromTeamWorkspaceAction,
} from "@/actions/teams";
import { Separator } from "@/components/ui/separator";
import type { DeckRow, TeamMemberRow } from "@/db/schema";
import type { TeamDeckAssignmentListRow } from "@/db/queries/teams";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import {
  TEAM_MEMBER_STUDY_PRIVILEGES,
  TEAM_MEMBER_STUDY_PRIVILEGE_LABELS,
  defaultTeamMemberStudyPrivilege,
  memberRoleQualifiesForStudyPrivileges,
  type TeamMemberStudyPrivilege,
} from "@/lib/team-study-privilege";

type MemberRow = TeamMemberRow;
type AssignmentRow = TeamDeckAssignmentListRow;

/** One flattened row in the “Assignments by member” table (client view). */
type AssignmentTableDisplayRow = {
  key: string;
  teamId: number;
  deckId: number;
  memberUserId: string;
  memberLabel: string;
  deckName: string;
  workspaceName: string;
  signedByLabel: string;
  signedByTitle: string | undefined;
  createdAt: Date | string | null;
  studyPrivilege: TeamMemberStudyPrivilege;
  memberRole: MemberRow["role"] | null;
};

export type TeamAssignWorkspaceSnapshot = {
  id: number;
  name: string;
  planSlug: string;
  /** Subscriber who owns this workspace. */
  ownerUserId: string;
  /** All rows in `team_members` for this workspace (includes team admins). */
  allMembers: MemberRow[];
  /** Invited `team_member` and `team_admin` rows that may receive deck assignments. */
  normalMembers: MemberRow[];
  decks: DeckRow[];
  assignments: AssignmentRow[];
};

export interface TeamDeckAssignListProps {
  workspaces: TeamAssignWorkspaceSnapshot[];
  defaultWorkspaceId: number;
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
  /** True when the signed-in user owns the selected workspace (subscriber). */
  viewerIsSubscriberOwner?: boolean;
  /** Subscriber-only — every Personal deck (matches Personal Dashboard); `alreadyLinked` is informational only. Omit for co-admins. */
  subscriberPersonalUnlinkedDecks?: Array<{
    id: number;
    name: string;
    /** True when this deck already appears in this workspace (linked or assigned here). */
    alreadyLinked?: boolean;
  }>;
}

function memberOptionLabel(
  userId: string,
  display: ClerkUserFieldDisplay | undefined,
) {
  const primary = display?.primaryLine ?? userId;
  return primary;
}

/** Name of the admin who created the assignment (prefer Clerk full name, then email local-part, then id). */
function assignmentAuditSignedByLabel(
  assignerUserId: string | null | undefined,
  display: ClerkUserFieldDisplay | undefined,
): string {
  if (assignerUserId == null || assignerUserId === "") return "—";
  const primary = display?.primaryLine?.trim();
  if (primary && primary !== assignerUserId) return primary;
  const email = display?.primaryEmail?.trim();
  if (email) {
    const at = email.indexOf("@");
    const local = at > 0 ? email.slice(0, at).trim() : email;
    if (local) return local;
  }
  const usernameLine = display?.secondaryLine?.trim();
  if (usernameLine) return usernameLine;
  return primary ?? assignerUserId;
}

function assignmentSignedByCellTitle(
  assignerUserId: string | null | undefined,
  display: ClerkUserFieldDisplay | undefined,
  shownLabel: string,
): string | undefined {
  if (!assignerUserId || shownLabel === "—") return undefined;
  const bits: string[] = [shownLabel];
  if (display?.primaryEmail?.trim()) bits.push(display.primaryEmail.trim());
  bits.push(assignerUserId);
  return bits.join(" · ");
}

function toAssignmentDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAssignmentRecordedAt(value: Date | string) {
  const date = toAssignmentDate(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

/** Placeholder values so Select stays controlled (never `value={undefined}`). */
const NO_MEMBER = "__fv_assign_member_none__";
const NO_DECK = "__fv_assign_deck_none__";

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";
const PLACEHOLDER_MEMBER = "Choose a member or co-admin to receive this deck…";
const PLACEHOLDER_DECK = "Choose which deck to assign…";

/** Assignments table — use a string constant so headers never use raw `&` in JSX (Turbopack parse errors). */
const ASSIGNMENTS_COL_DATE_TIME = "Date and time";

const LINK_NO_DECK = "__fv_link_personal_deck_none__";
const PLACEHOLDER_LINK_DECK = "Choose a personal deck to link…";

const CAPTION_TEAM_WORKSPACE =
  "Start here — pick which team's workspace you are assigning for. Members and decks below update to match this workspace.";

const CAPTION_NORMAL_MEMBER =
  "Choose who should see the deck in their workspace Study view — invited team members and team admins (co-admins).";

const CAPTION_DECK =
  "Only decks linked to this workspace appear here — create on your Personal Dashboard, then link deck to this workspace below, or create a deck directly scoped to this workspace.";

const CAPTION_STUDY_PRIVILEGE =
  "Choose whether the assignee may use Standard Review, AI Recall™, Quiz, or a combination on the study page for this deck. Team admins on Education Gold / Enterprise can be limited here; on other plans team admins always have full study access.";

const CAPTION_LINK_PERSONAL =
  "Lists every deck from your Personal Dashboard. Decks already tied to this workspace stay selectable — linking again simply confirms they remain attached (no duplicate).";

const TOOLTIP_ASSIGNMENT_TABLE_ROW =
  "Tap or click to load this assignment in the form above and open access details. Only the workspace subscriber (owner) can remove a member's deck access.";

function HintBalloon({ fieldLabel, caption }: { fieldLabel: string; caption: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            {...props}
            className={cn(
              "size-7 shrink-0 text-muted-foreground hover:text-foreground",
              props.className,
            )}
            aria-label={`${fieldLabel} — help`}
          >
            <CircleHelp className="size-4 shrink-0" aria-hidden />
          </Button>
        )}
      />
      <TooltipContent side="top" className="max-w-xs text-pretty text-left">
        <span className="block text-xs leading-snug">{caption}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function TeamDeckAssignList({
  workspaces,
  defaultWorkspaceId,
  userFieldDisplayById,
  viewerIsSubscriberOwner = false,
  subscriberPersonalUnlinkedDecks,
}: TeamDeckAssignListProps) {
  const { userId: clerkUserId } = useAuth();
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = React.useState(String(defaultWorkspaceId));
  const [memberUserId, setMemberUserId] = React.useState(NO_MEMBER);
  const [deckId, setDeckId] = React.useState(NO_DECK);
  const [studyPrivilege, setStudyPrivilege] = React.useState<TeamMemberStudyPrivilege>(
    defaultTeamMemberStudyPrivilege(),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"assign" | "unassign" | null>(null);
  const [linkDeckId, setLinkDeckId] = React.useState(LINK_NO_DECK);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [linkBusy, setLinkBusy] = React.useState(false);
  const [unlinkBusy, setUnlinkBusy] = React.useState(false);
  const [unlinkDialogOpen, setUnlinkDialogOpen] = React.useState(false);
  const [expandedAssignmentKey, setExpandedAssignmentKey] = React.useState<string | null>(null);
  const [removeAccessDialogOpen, setRemoveAccessDialogOpen] = React.useState(false);
  const [removeAccessRow, setRemoveAccessRow] = React.useState<AssignmentTableDisplayRow | null>(
    null,
  );

  React.useEffect(() => {
    setWorkspaceId(String(defaultWorkspaceId));
    setMemberUserId(NO_MEMBER);
    setDeckId(NO_DECK);
    setStudyPrivilege(defaultTeamMemberStudyPrivilege());
    setLinkDeckId(LINK_NO_DECK);
    setExpandedAssignmentKey(null);
  }, [defaultWorkspaceId]);

  const workspace = workspaces.find((w) => w.id === Number(workspaceId));
  const normalMembers = workspace?.normalMembers ?? [];
  const decks = workspace?.decks ?? [];
  const assignments = workspace?.assignments ?? [];
  // Reactive "already linked" status for the personal-deck link dropdown — must
  // mirror the decks actually scoped to the SELECTED workspace, otherwise the
  // badge can disagree with the "No workspace-linked decks yet" message below.
  const workspaceLinkedDeckIds = React.useMemo(
    () => new Set(decks.map((d) => d.id)),
    [decks],
  );
  const viewerOwnsSelectedWorkspace = Boolean(
    workspace && clerkUserId && workspace.ownerUserId === clerkUserId,
  );

  function isAssignmentRowWorkspaceOwner(row: AssignmentTableDisplayRow) {
    if (!clerkUserId) return false;
    const w = workspaces.find((x) => x.id === row.teamId);
    return w?.ownerUserId === clerkUserId;
  }

  /** When true, the next `workspaceId` change must not clear member/deck (e.g. loading a row from the table). */
  const skipAssignMemberDeckResetRef = React.useRef(false);

  React.useEffect(() => {
    if (skipAssignMemberDeckResetRef.current) {
      skipAssignMemberDeckResetRef.current = false;
      return;
    }
    setMemberUserId(NO_MEMBER);
    setDeckId(NO_DECK);
    setStudyPrivilege(defaultTeamMemberStudyPrivilege());
    setLinkDeckId(LINK_NO_DECK);
  }, [workspaceId]);

  const selectedMember =
    memberUserId !== NO_MEMBER
      ? normalMembers.find((m) => m.userId === memberUserId)
      : undefined;
  const selectedMemberQualifiesForStudyPrivileges =
    selectedMember != null &&
    memberRoleQualifiesForStudyPrivileges(
      selectedMember.role,
      workspace?.planSlug ?? "",
    );

  const assignmentTableWorkspaces = React.useMemo(() => {
    if (viewerIsSubscriberOwner) return workspaces;
    return workspaces.filter((w) => w.id === defaultWorkspaceId);
  }, [workspaces, defaultWorkspaceId, viewerIsSubscriberOwner]);

  const assignmentTableRows = React.useMemo((): AssignmentTableDisplayRow[] => {
    const out: AssignmentTableDisplayRow[] = [];
    for (const w of assignmentTableWorkspaces) {
      const workspaceMemberIds = new Set(w.allMembers.map((m) => m.userId));
      for (const a of w.assignments) {
        if (!viewerIsSubscriberOwner && !workspaceMemberIds.has(a.memberUserId)) {
          continue;
        }
        const deck = w.decks.find((d) => d.id === a.deckId);
        const memberRecord = w.allMembers.find((m) => m.userId === a.memberUserId);
        const byId = a.assignedByUserId;
        const signedByLabel = assignmentAuditSignedByLabel(
          byId,
          byId ? userFieldDisplayById[byId] : undefined,
        );
        out.push({
          key: `${a.teamId}-${a.deckId}-${a.memberUserId}`,
          teamId: a.teamId,
          deckId: a.deckId,
          memberUserId: a.memberUserId,
          memberLabel: memberOptionLabel(
            a.memberUserId,
            userFieldDisplayById[a.memberUserId],
          ),
          deckName: deck?.name ?? `Deck #${a.deckId}`,
          workspaceName: w.name,
          signedByLabel,
          signedByTitle: assignmentSignedByCellTitle(
            byId,
            byId ? userFieldDisplayById[byId] : undefined,
            signedByLabel,
          ),
          createdAt: a.createdAt ?? null,
          studyPrivilege: a.studyPrivilege ?? defaultTeamMemberStudyPrivilege(),
          memberRole: memberRecord?.role ?? null,
        });
      }
    }
    out.sort((a, b) => {
      const ta = toAssignmentDate(a.createdAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
      const tb = toAssignmentDate(b.createdAt)?.getTime() ?? Number.NEGATIVE_INFINITY;
      const t = tb - ta;
      if (t !== 0) return t;
      const w = a.workspaceName.localeCompare(b.workspaceName);
      if (w !== 0) return w;
      const m = a.memberLabel.localeCompare(b.memberLabel);
      if (m !== 0) return m;
      return a.deckName.localeCompare(b.deckName);
    });
    return out;
  }, [assignmentTableWorkspaces, userFieldDisplayById, viewerIsSubscriberOwner]);

  const assignmentTableColumns = React.useMemo(
    () =>
      [
        {
          id: "member",
          header: "Member",
          className: "min-w-[10rem]",
          cell: (row: AssignmentTableDisplayRow) => {
            const display = userFieldDisplayById[row.memberUserId];
            return (
              <div className="min-w-0">
                <p className="font-medium text-foreground">{row.memberLabel}</p>
                {display?.primaryEmail ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {display.primaryEmail}
                  </p>
                ) : null}
              </div>
            );
          },
        },
        {
          id: "deck",
          header: "Deck",
          className: "min-w-[8rem]",
          cell: (row: AssignmentTableDisplayRow) => (
            <span className="text-sm text-foreground">{row.deckName}</span>
          ),
        },
        ...(viewerIsSubscriberOwner
          ? [
              {
                id: "workspace",
                header: "Workspace",
                className: "min-w-[8rem]",
                cell: (row: AssignmentTableDisplayRow) => (
                  <span className="text-sm text-foreground">{row.workspaceName}</span>
                ),
              },
            ]
          : []),
        {
          id: "signedBy",
          header: "Signed by",
          className: "min-w-[6rem]",
          cell: (row: AssignmentTableDisplayRow) => (
            <span className="text-sm text-foreground" title={row.signedByTitle}>
              {row.signedByLabel}
            </span>
          ),
        },
        {
          id: "assigned",
          header: "Assigned",
          className: "whitespace-nowrap",
          cell: (row: AssignmentTableDisplayRow) => (
            <span className="text-sm text-muted-foreground">
              {row.createdAt ? formatAssignmentRecordedAt(row.createdAt) : "—"}
            </span>
          ),
        },
      ] as const,
    [userFieldDisplayById, viewerIsSubscriberOwner],
  );

  const assignmentDeckFilterOptions = React.useMemo(
    () => [...new Set(assignmentTableRows.map((r) => r.deckName))].sort((a, b) => a.localeCompare(b)),
    [assignmentTableRows],
  );

  function assignmentSearchHaystack(row: AssignmentTableDisplayRow): string {
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

  function isAssigned(teamId: number, dId: number, mId: string) {
    return assignments.some(
      (a) => a.deckId === dId && a.memberUserId === mId && a.teamId === teamId,
    );
  }

  const teamIdNum = Number(workspaceId);
  const deckIdNum = deckId !== NO_DECK ? Number(deckId) : NaN;
  const canSubmit =
    workspace &&
    !Number.isNaN(teamIdNum) &&
    memberUserId !== NO_MEMBER &&
    memberUserId.length > 0 &&
    deckId !== NO_DECK &&
    !Number.isNaN(deckIdNum);

  const linkDeckNum =
    linkDeckId !== LINK_NO_DECK ? Number(linkDeckId) : NaN;
  const linkDeckEntry =
    linkDeckId !== LINK_NO_DECK && subscriberPersonalUnlinkedDecks != null
      ? subscriberPersonalUnlinkedDecks.find((x) => String(x.id) === String(linkDeckId))
      : undefined;
  const canLinkPersonal =
    workspace &&
    !Number.isNaN(teamIdNum) &&
    linkDeckId !== LINK_NO_DECK &&
    !Number.isNaN(linkDeckNum) &&
    linkDeckEntry != null;
  const selectedLinkDeckAlreadyLinked =
    linkDeckId !== LINK_NO_DECK &&
    !Number.isNaN(linkDeckNum) &&
    workspaceLinkedDeckIds.has(linkDeckNum);
  // Only the workspace subscriber (owner) may unlink — matches the server action.
  const canUnlinkPersonal =
    Boolean(canLinkPersonal) &&
    selectedLinkDeckAlreadyLinked &&
    viewerOwnsSelectedWorkspace;

  async function onLinkPersonalDeck() {
    if (!canLinkPersonal) return;
    setLinkError(null);
    setLinkBusy(true);
    try {
      await linkPersonalDeckToTeamWorkspaceAction({
        teamId: teamIdNum,
        deckId: linkDeckNum,
      });
      setLinkDeckId(LINK_NO_DECK);
      router.refresh();
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Link failed.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function onUnlinkPersonalDeck() {
    if (!canUnlinkPersonal) return;
    setLinkError(null);
    setUnlinkBusy(true);
    try {
      await unlinkPersonalDeckFromTeamWorkspaceAction({
        teamId: teamIdNum,
        deckId: linkDeckNum,
      });
      setUnlinkDialogOpen(false);
      setLinkDeckId(LINK_NO_DECK);
      router.refresh();
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : "Unlink failed.");
    } finally {
      setUnlinkBusy(false);
    }
  }

  const assigned =
    canSubmit && isAssigned(teamIdNum, deckIdNum, memberUserId);

  const existingAssignment =
    canSubmit
      ? assignments.find(
          (a) =>
            a.teamId === teamIdNum &&
            a.deckId === deckIdNum &&
            a.memberUserId === memberUserId,
        )
      : undefined;

  const savedStudyPrivilege =
    existingAssignment?.studyPrivilege ?? defaultTeamMemberStudyPrivilege();

  const studyPrivilegeChanged =
    selectedMemberQualifiesForStudyPrivileges && studyPrivilege !== savedStudyPrivilege;

  async function onAssign() {
    if (!canSubmit) return;
    if (assigned && !selectedMemberQualifiesForStudyPrivileges) return;
    if (assigned && selectedMemberQualifiesForStudyPrivileges && !studyPrivilegeChanged) return;
    setError(null);
    setBusy("assign");
    try {
      await assignDeckToMemberAction({
        teamId: teamIdNum,
        deckId: deckIdNum,
        memberUserId,
        studyPrivilege: selectedMemberQualifiesForStudyPrivileges
          ? studyPrivilege
          : defaultTeamMemberStudyPrivilege(),
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(null);
    }
  }

  async function onUnassign() {
    if (!canSubmit || !assigned || !viewerOwnsSelectedWorkspace) return;
    setError(null);
    setBusy("unassign");
    try {
      await unassignDeckFromMemberAction({
        teamId: teamIdNum,
        deckId: deckIdNum,
        memberUserId,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unassign failed");
    } finally {
      setBusy(null);
    }
  }

  function applyAssignmentFromTableRow(row: AssignmentTableDisplayRow) {
    const nextWorkspace = String(row.teamId);
    if (nextWorkspace !== workspaceId) {
      skipAssignMemberDeckResetRef.current = true;
      setWorkspaceId(nextWorkspace);
    }
    setMemberUserId(row.memberUserId);
    setDeckId(String(row.deckId));
    if (row.memberRole === "team_member") {
      setStudyPrivilege(row.studyPrivilege);
    } else {
      setStudyPrivilege(defaultTeamMemberStudyPrivilege());
    }
    setError(null);
  }

  function onAssignmentTableRowActivate(row: AssignmentTableDisplayRow) {
    applyAssignmentFromTableRow(row);
    setExpandedAssignmentKey((prev) => (prev === row.key ? null : row.key));
  }

  function renderAssignmentAccessPanel(row: AssignmentTableDisplayRow) {
    return (
      <div className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Access management
        </p>
        {isAssignmentRowWorkspaceOwner(row) ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-9 w-full sm:w-auto"
            disabled={busy !== null}
            onClick={() => {
              setRemoveAccessRow(row);
              setRemoveAccessDialogOpen(true);
            }}
          >
            Remove assignment
          </Button>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Only the workspace subscriber (owner) can remove this member&apos;s access to this deck.
          </p>
        )}
      </div>
    );
  }

  async function handleConfirmRemoveAccess() {
    const target = removeAccessRow;
    if (!target || !isAssignmentRowWorkspaceOwner(target)) return;
    const collapseKey = target.key;
    setError(null);
    setBusy("unassign");
    try {
      await unassignDeckFromMemberAction({
        teamId: target.teamId,
        deckId: target.deckId,
        memberUserId: target.memberUserId,
      });
      setRemoveAccessDialogOpen(false);
      setRemoveAccessRow(null);
      setExpandedAssignmentKey((prev) => (prev === collapseKey ? null : prev));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove access failed");
    } finally {
      setBusy(null);
    }
  }

  if (workspaces.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No team workspaces available for deck assignment.
      </p>
    );
  }

  return (
    <>
    <div className="w-full max-w-3xl space-y-6">
        {(error || linkError) && (
          <div className="space-y-1">
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            {linkError ? (
              <p className="text-sm text-destructive" role="alert">
                {linkError}
              </p>
            ) : null}
          </div>
        )}

      <div className="space-y-2 rounded-lg border border-border/70 bg-muted/15 p-4">
        <div className="flex items-center gap-1">
          <Label
            htmlFor="assign-deck-workspace"
            className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Team workspace
          </Label>
          <HintBalloon fieldLabel="Team workspace" caption={CAPTION_TEAM_WORKSPACE} />
        </div>
        <span id="assign-deck-workspace-caption" className="sr-only">
          {CAPTION_TEAM_WORKSPACE}
        </span>
        <Select
          value={workspaceId}
          onValueChange={(v) => v != null && setWorkspaceId(v)}
        >
          <SelectTrigger
            id="assign-deck-workspace"
            className="h-10 w-full bg-background"
            aria-describedby="assign-deck-workspace-caption"
          >
            <SelectValue placeholder={PLACEHOLDER_WORKSPACE}>
              {(value) => {
                const w = workspaces.find((t) => String(t.id) === String(value));
                if (w) return w.name;
                return (
                  <span className="text-muted-foreground">{PLACEHOLDER_WORKSPACE}</span>
                );
              }}
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
      </div>

      {subscriberPersonalUnlinkedDecks &&
      subscriberPersonalUnlinkedDecks.length > 0 &&
      workspace ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="link-personal-deck-select">Deck from Personal Dashboard</Label>
              <HintBalloon fieldLabel="Link deck" caption={CAPTION_LINK_PERSONAL} />
            </div>
            <span id="link-personal-caption" className="sr-only">
              {CAPTION_LINK_PERSONAL}
            </span>
            <p className="text-xs text-muted-foreground leading-snug">
              Create and edit flashcard decks from your Personal Dashboard, then tie them here to{" "}
              <span className="font-medium text-foreground">{workspace.name}</span> so you can assign
              them to members below.
            </p>
          </div>
          <Select
            value={linkDeckId}
            onValueChange={(v) => v != null && setLinkDeckId(v)}
          >
            <SelectTrigger
              id="link-personal-deck-select"
              className="w-full"
              aria-describedby="link-personal-caption"
            >
              <SelectValue placeholder={PLACEHOLDER_LINK_DECK}>
                {(value) => {
                  if (value === LINK_NO_DECK || value == null) {
                    return (
                      <span className="text-muted-foreground">{PLACEHOLDER_LINK_DECK}</span>
                    );
                  }
                  const d = subscriberPersonalUnlinkedDecks.find(
                    (x) => String(x.id) === String(value),
                  );
                  return (
                    d?.name ?? (
                      <span className="text-muted-foreground">{PLACEHOLDER_LINK_DECK}</span>
                    )
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LINK_NO_DECK} className="text-muted-foreground">
                {PLACEHOLDER_LINK_DECK}
              </SelectItem>
              {subscriberPersonalUnlinkedDecks.map((d) => {
                const alreadyLinked = workspaceLinkedDeckIds.has(d.id);
                return (
                  <SelectItem key={d.id} value={String(d.id)}>
                    <span className="truncate">
                      {d.name}
                      {alreadyLinked ? (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          (already linked)
                        </span>
                      ) : null}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={!canLinkPersonal || linkBusy || unlinkBusy}
              onClick={() => void onLinkPersonalDeck()}
            >
              {linkBusy ? "Linking…" : "Link deck to workspace"}
            </Button>
            {selectedLinkDeckAlreadyLinked ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={!canUnlinkPersonal || linkBusy || unlinkBusy}
                onClick={() => setUnlinkDialogOpen(true)}
              >
                {unlinkBusy ? "Unlinking…" : "Unlink from workspace"}
              </Button>
            ) : null}
          </div>
          {selectedLinkDeckAlreadyLinked && !viewerOwnsSelectedWorkspace ? (
            <p className="text-xs text-muted-foreground">
              Only the workspace subscriber (owner) can unlink a deck from this workspace.
            </p>
          ) : null}
        </div>
      ) : null}

      {!workspace ? null : normalMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add team members or team admins to this workspace first — they can receive deck assignments
          here.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="assign-deck-member">Member or co-admin</Label>
              <HintBalloon fieldLabel="Normal member" caption={CAPTION_NORMAL_MEMBER} />
            </div>
            <span id="assign-deck-member-caption" className="sr-only">
              {CAPTION_NORMAL_MEMBER}
            </span>
            <Select
              value={memberUserId}
              onValueChange={(v) => v != null && setMemberUserId(v)}
            >
              <SelectTrigger
                id="assign-deck-member"
                className="w-full"
                aria-describedby="assign-deck-member-caption"
              >
                <SelectValue placeholder={PLACEHOLDER_MEMBER}>
                  {(value) =>
                    value === NO_MEMBER || value == null ? (
                      <span className="text-muted-foreground">{PLACEHOLDER_MEMBER}</span>
                    ) : (
                      memberOptionLabel(
                        value as string,
                        userFieldDisplayById[value as string],
                      )
                    )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MEMBER} className="text-muted-foreground">
                  {PLACEHOLDER_MEMBER}
                </SelectItem>
                {normalMembers.map((m) => {
                  const label = memberOptionLabel(m.userId, userFieldDisplayById[m.userId]);
                  return (
                    <SelectItem key={m.userId} value={m.userId}>
                      <span className="truncate">{label}</span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {decks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {subscriberPersonalUnlinkedDecks === undefined
                ? "No decks linked to this workspace yet — wait for your subscriber to attach decks from their Personal Dashboard (or scoped team decks)."
                : subscriberPersonalUnlinkedDecks.length > 0
                  ? "No workspace-linked decks yet — link a Personal Dashboard deck above, then assign members here."
                  : "Create decks on your Personal Dashboard first, link them above, then assign members here."}
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="assign-deck-deck">Deck</Label>
                  <HintBalloon fieldLabel="Deck" caption={CAPTION_DECK} />
                </div>
                <span id="assign-deck-deck-caption" className="sr-only">
                  {CAPTION_DECK}
                </span>
                <Select
                  value={deckId}
                  onValueChange={(v) => v != null && setDeckId(v)}
                >
                  <SelectTrigger
                    id="assign-deck-deck"
                    className="w-full"
                    aria-describedby="assign-deck-deck-caption"
                  >
                    <SelectValue placeholder={PLACEHOLDER_DECK}>
                      {(value) => {
                        if (value === NO_DECK || value == null) {
                          return (
                            <span className="text-muted-foreground">{PLACEHOLDER_DECK}</span>
                          );
                        }
                        const d = decks.find((x) => String(x.id) === String(value));
                        return (
                          d?.name ?? (
                            <span className="text-muted-foreground">{PLACEHOLDER_DECK}</span>
                          )
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DECK} className="text-muted-foreground">
                      {PLACEHOLDER_DECK}
                    </SelectItem>
                    {decks.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        <span className="truncate">{d.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMemberQualifiesForStudyPrivileges ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="assign-deck-study-privilege">Study modes</Label>
                    <HintBalloon fieldLabel="Study modes" caption={CAPTION_STUDY_PRIVILEGE} />
                  </div>
                  <span id="assign-deck-study-privilege-caption" className="sr-only">
                    {CAPTION_STUDY_PRIVILEGE}
                  </span>
                  <Select
                    value={studyPrivilege}
                    onValueChange={(v) =>
                      v != null && setStudyPrivilege(v as TeamMemberStudyPrivilege)
                    }
                  >
                    <SelectTrigger
                      id="assign-deck-study-privilege"
                      className="w-full"
                      aria-describedby="assign-deck-study-privilege-caption"
                    >
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
                </div>
              ) : null}

              {assigned && (
                <p className="text-sm text-muted-foreground">
                  This deck is already assigned to this member for their workspace Study view.
                  {selectedMemberQualifiesForStudyPrivileges
                    ? " Re-assign to update study modes, or edit on the Study privileges tab."
                    : null}
                </p>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  className="h-10 w-full"
                  disabled={
                    !canSubmit ||
                    busy !== null ||
                    (assigned && !selectedMemberQualifiesForStudyPrivileges) ||
                    (assigned && selectedMemberQualifiesForStudyPrivileges && !studyPrivilegeChanged)
                  }
                  onClick={onAssign}
                >
                  {busy === "assign"
                    ? "Saving…"
                    : assigned && selectedMemberQualifiesForStudyPrivileges
                      ? "Update assignment"
                      : assigned
                        ? "Already assigned"
                        : "Assign deck"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full"
                  disabled={
                    !canSubmit || !assigned || busy !== null || !viewerOwnsSelectedWorkspace
                  }
                  onClick={onUnassign}
                >
                  {busy === "unassign" ? "Removing…" : "Remove assignment"}
                </Button>
              </div>
              {!viewerOwnsSelectedWorkspace ? (
                <p className="text-xs text-muted-foreground">
                  Only the workspace subscriber (owner) can remove a member&apos;s deck access. Assign
                  and link actions stay available for team admins.
                </p>
              ) : null}
            </>
          )}
        </>
      )}

      <Separator className="my-2" />

      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Assignments by member</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {viewerIsSubscriberOwner
              ? "All members and deck assignments across your workspaces. Click a row to load it into the form above. Only you can remove assignments."
              : "Members and deck assignments for this workspace only. Click a row to load it into the form above. Only the workspace owner can remove assignments."}
          </p>
        </div>

        <TeamAdminRecordSlider
          items={assignmentTableRows}
          activeKey={expandedAssignmentKey}
          onActivate={onAssignmentTableRowActivate}
          layout="table"
          tableGroupByMember
          tablePageSize={10}
          deckFilterOptions={assignmentDeckFilterOptions}
          showDateSort
          getSearchHaystack={assignmentSearchHaystack}
          getSortDate={(row) => toAssignmentDate(row.createdAt)?.getTime() ?? null}
          emptyMessage={
            viewerIsSubscriberOwner
              ? "No deck assignments yet."
              : "No deck assignments for this workspace yet."
          }
          noResultsMessage="No assignments match your search or filters."
          tableColumns={[...assignmentTableColumns]}
          renderBelowActive={(row) =>
            expandedAssignmentKey === row.key ? renderAssignmentAccessPanel(row) : null
          }
        />
      </div>
    </div>

    <AlertDialog
      open={unlinkDialogOpen}
      onOpenChange={(open) => {
        if (!unlinkBusy) setUnlinkDialogOpen(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unlink deck from workspace?</AlertDialogTitle>
          <AlertDialogDescription>
            {linkDeckEntry ? (
              <>
                This unlinks{" "}
                <span className="font-medium text-foreground">{linkDeckEntry.name}</span>{" "}
                from{" "}
                <span className="font-medium text-foreground">
                  {workspace?.name ?? "this workspace"}
                </span>
                . <span className="font-medium text-foreground">Every member</span> of this
                workspace will lose access to the deck. The deck stays on your Personal
                Dashboard — you can re-link it later.
              </>
            ) : (
              "Unlink this deck from the workspace? All members will lose access."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={unlinkBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={unlinkBusy || !canUnlinkPersonal}
            onClick={(e) => {
              e.preventDefault();
              void onUnlinkPersonalDeck();
            }}
          >
            {unlinkBusy ? "Unlinking…" : "Unlink deck"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={removeAccessDialogOpen}
      onOpenChange={(open) => {
        setRemoveAccessDialogOpen(open);
        if (!open) setRemoveAccessRow(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove deck access?</AlertDialogTitle>
          <AlertDialogDescription>
            {removeAccessRow ? (
              <>
                This removes Study access for{" "}
                <span className="font-medium text-foreground">{removeAccessRow.memberLabel}</span>{" "}
                to deck{" "}
                <span className="font-medium text-foreground">{removeAccessRow.deckName}</span> in{" "}
                <span className="font-medium text-foreground">{removeAccessRow.workspaceName}</span>
                . They can be assigned again later.
              </>
            ) : (
              "Remove this assignment?"
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy === "unassign"}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy === "unassign" || removeAccessRow == null}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirmRemoveAccess();
            }}
          >
            {busy === "unassign" ? "Removing…" : "Remove access"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
