"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignDeckToMemberAction,
  transferTeamDeckWorkspaceAction,
  unassignDeckFromMemberAction,
} from "@/actions/teams";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DeckRow,
  TeamDeckAssignmentRow,
  TeamMemberRow,
} from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";

type MemberRow = TeamMemberRow;
type AssignmentRow = TeamDeckAssignmentRow;

export type TeamAssignWorkspaceSnapshot = {
  id: number;
  name: string;
  /** Subscriber who owns this workspace — deck transfers are only allowed between matching owners. */
  ownerUserId: string;
  /** All rows in `team_members` for this workspace (includes team admins). */
  allMembers: MemberRow[];
  normalMembers: MemberRow[];
  decks: DeckRow[];
  assignments: AssignmentRow[];
};

interface TeamDeckAssignListProps {
  workspaces: TeamAssignWorkspaceSnapshot[];
  defaultWorkspaceId: number;
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
  /** When set, switching tabs updates the route (`assign-decks-to-members` vs `move-deck-to-another-ws`). */
  deckManagerTabUrls?: {
    assignMembersHref: string;
    moveDeckHref: string;
  };
}

function memberOptionLabel(
  userId: string,
  display: ClerkUserFieldDisplay | undefined,
) {
  const primary = display?.primaryLine ?? userId;
  return primary;
}

/** Placeholder values so Select stays controlled (never `value={undefined}`). */
const NO_MEMBER = "__fv_assign_member_none__";
const NO_DECK = "__fv_assign_deck_none__";

const PLACEHOLDER_WORKSPACE = "Choose a team workspace…";
const PLACEHOLDER_MEMBER = "Choose a member to receive this deck…";
const PLACEHOLDER_DECK = "Choose which deck to assign…";

const TR_NO_DECK = "__fv_transfer_deck_none__";
const TR_NO_TO = "__fv_transfer_to_none__";
const PLACEHOLDER_TR_DECK = "Choose a deck to move…";
const PLACEHOLDER_TR_TO = "Choose destination workspace…";

const CAPTION_TEAM_WORKSPACE =
  "Start here — pick which team's workspace you are assigning for. Members and decks below update to match this workspace.";

const CAPTION_NORMAL_MEMBER =
  "Choose who should see the deck on their team dashboard — invited members with the normal role only; admins already see every team deck.";

const CAPTION_DECK =
  "Pick a team deck from this workspace — only decks you create here can be assigned to members for study and preview.";

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
  deckManagerTabUrls,
}: TeamDeckAssignListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeDeckManagerTab =
    deckManagerTabUrls != null && pathname.includes("/move-deck-to-another-ws")
      ? "move-deck"
      : "assign-members";

  function onDeckManagerTabChange(value: string) {
    if (!deckManagerTabUrls) return;
    const href =
      value === "move-deck"
        ? deckManagerTabUrls.moveDeckHref
        : deckManagerTabUrls.assignMembersHref;
    router.replace(href);
  }
  const [workspaceId, setWorkspaceId] = React.useState(String(defaultWorkspaceId));
  const [memberUserId, setMemberUserId] = React.useState(NO_MEMBER);
  const [deckId, setDeckId] = React.useState(NO_DECK);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"assign" | "unassign" | null>(null);

  const [transferFromTeamId, setTransferFromTeamId] = React.useState(
    String(defaultWorkspaceId),
  );
  const [transferDeckId, setTransferDeckId] = React.useState(TR_NO_DECK);
  const [transferToTeamId, setTransferToTeamId] = React.useState(TR_NO_TO);
  const [transferError, setTransferError] = React.useState<string | null>(null);
  const [transferBusy, setTransferBusy] = React.useState(false);

  React.useEffect(() => {
    setWorkspaceId(String(defaultWorkspaceId));
    setMemberUserId(NO_MEMBER);
    setDeckId(NO_DECK);
    setTransferFromTeamId(String(defaultWorkspaceId));
    setTransferDeckId(TR_NO_DECK);
    setTransferToTeamId(TR_NO_TO);
  }, [defaultWorkspaceId]);

  const workspace = workspaces.find((w) => w.id === Number(workspaceId));
  const normalMembers = workspace?.normalMembers ?? [];
  const decks = workspace?.decks ?? [];
  const assignments = workspace?.assignments ?? [];

  /** When true, the next `workspaceId` change must not clear member/deck (e.g. loading a row from the table). */
  const skipAssignMemberDeckResetRef = React.useRef(false);

  React.useEffect(() => {
    if (skipAssignMemberDeckResetRef.current) {
      skipAssignMemberDeckResetRef.current = false;
      return;
    }
    setMemberUserId(NO_MEMBER);
    setDeckId(NO_DECK);
  }, [workspaceId]);

  React.useEffect(() => {
    setTransferDeckId(TR_NO_DECK);
    setTransferToTeamId(TR_NO_TO);
  }, [transferFromTeamId]);

  const assignmentTableRows = React.useMemo(() => {
    type Row = {
      key: string;
      teamId: number;
      deckId: number;
      memberUserId: string;
      memberLabel: string;
      deckName: string;
      workspaceName: string;
    };
    const out: Row[] = [];
    for (const w of workspaces) {
      for (const a of w.assignments) {
        const deck = w.decks.find((d) => d.id === a.deckId);
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
        });
      }
    }
    out.sort((a, b) => {
      const w = a.workspaceName.localeCompare(b.workspaceName);
      if (w !== 0) return w;
      const m = a.memberLabel.localeCompare(b.memberLabel);
      if (m !== 0) return m;
      return a.deckName.localeCompare(b.deckName);
    });
    return out;
  }, [workspaces, userFieldDisplayById]);

  const transferFromWorkspace = workspaces.find(
    (w) => w.id === Number(transferFromTeamId),
  );
  const transferDeckOptions = transferFromWorkspace?.decks ?? [];
  const transferToCandidates = transferFromWorkspace
    ? workspaces.filter(
        (w) =>
          w.id !== transferFromWorkspace.id &&
          w.ownerUserId === transferFromWorkspace.ownerUserId,
      )
    : [];

  const transferFromNum = Number(transferFromTeamId);
  const transferDeckNum =
    transferDeckId !== TR_NO_DECK ? Number(transferDeckId) : NaN;
  const transferToNum = transferToTeamId !== TR_NO_TO ? Number(transferToTeamId) : NaN;
  const canTransferSubmit =
    transferFromWorkspace &&
    transferToCandidates.length > 0 &&
    transferDeckId !== TR_NO_DECK &&
    transferToTeamId !== TR_NO_TO &&
    !Number.isNaN(transferDeckNum) &&
    !Number.isNaN(transferToNum) &&
    transferToNum !== transferFromNum;

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

  const assigned =
    canSubmit && isAssigned(teamIdNum, deckIdNum, memberUserId);

  async function onAssign() {
    if (!canSubmit || assigned) return;
    setError(null);
    setBusy("assign");
    try {
      await assignDeckToMemberAction({
        teamId: teamIdNum,
        deckId: deckIdNum,
        memberUserId,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(null);
    }
  }

  async function onUnassign() {
    if (!canSubmit || !assigned) return;
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

  function applyAssignmentFromTableRow(row: {
    teamId: number;
    deckId: number;
    memberUserId: string;
  }) {
    const nextWorkspace = String(row.teamId);
    if (nextWorkspace !== workspaceId) {
      skipAssignMemberDeckResetRef.current = true;
      setWorkspaceId(nextWorkspace);
    }
    setMemberUserId(row.memberUserId);
    setDeckId(String(row.deckId));
    setError(null);
  }

  async function onTransferDeck() {
    if (!canTransferSubmit) return;
    setTransferError(null);
    setTransferBusy(true);
    try {
      await transferTeamDeckWorkspaceAction({
        deckId: transferDeckNum,
        fromTeamId: transferFromNum,
        toTeamId: transferToNum,
      });
      setTransferDeckId(TR_NO_DECK);
      setTransferToTeamId(TR_NO_TO);
      router.refresh();
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setTransferBusy(false);
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
    <Tabs
      {...(deckManagerTabUrls
        ? {
            value: activeDeckManagerTab,
            onValueChange: onDeckManagerTabChange,
          }
        : { defaultValue: "assign-members" })}
      className="w-full max-w-2xl gap-4"
    >
      <TabsList
        variant="line"
        className="h-auto w-full min-w-0 flex-wrap justify-start gap-0 border-b border-border bg-transparent p-0"
      >
        <TabsTrigger
          value="assign-members"
          className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
        >
          Assign decks to members
        </TabsTrigger>
        <TabsTrigger
          value="move-deck"
          className="shrink-0 rounded-none border-b-2 border-transparent px-2.5 py-2 text-xs data-active:border-primary data-active:bg-transparent sm:px-3 sm:text-sm"
        >
          Move deck to another workspace
        </TabsTrigger>
      </TabsList>

      <TabsContent value="assign-members" className="mt-0 space-y-6">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="assign-deck-workspace">Team workspace</Label>
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
            className="w-full"
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

      {!workspace ? null : normalMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Add normal members to this workspace first — only they receive deck assignments.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="assign-deck-member">Normal member</Label>
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
              Create team decks in this workspace to assign them here.
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

              {assigned && (
                <p className="text-sm text-muted-foreground">
                  This deck is already assigned to this member for their team dashboard.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!canSubmit || assigned || busy !== null}
                  onClick={onAssign}
                >
                  {busy === "assign" ? "Assigning…" : "Assign"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canSubmit || !assigned || busy !== null}
                  onClick={onUnassign}
                >
                  {busy === "unassign" ? "Removing…" : "Unassign"}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <Separator className="my-2" />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Assignments by member</h3>
        <p className="text-sm text-muted-foreground leading-snug">
          Normal members and the team deck they are assigned on each workspace. Double-click a row
          to load it into the form above — Unassign becomes available and Assign is disabled while
          that assignment is selected.
        </p>
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Deck</TableHead>
                <TableHead>Workspace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignmentTableRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground text-sm">
                    No deck assignments yet.
                  </TableCell>
                </TableRow>
              ) : (
                assignmentTableRows.map((row) => (
                  <TableRow
                    key={row.key}
                    className="cursor-pointer hover:bg-muted/50"
                    onDoubleClick={() => applyAssignmentFromTableRow(row)}
                    title="Double-click to load this assignment in the form above"
                  >
                    <TableCell className="max-w-[min(100%,220px)]">
                      <span className="truncate font-medium" title={row.memberLabel}>
                        {row.memberLabel}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[min(100%,220px)]">
                      <span className="truncate" title={row.deckName}>
                        {row.deckName}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[min(100%,200px)]">
                      <span className="truncate text-muted-foreground" title={row.workspaceName}>
                        {row.workspaceName}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      </TabsContent>

      <TabsContent value="move-deck" className="mt-0 space-y-4">
        {workspaces.length > 1 ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-snug">
              Move a team deck between workspaces owned by the same subscriber. Member assignments
              for that deck are cleared — assign again on the destination workspace.
            </p>
          </div>
          {transferError && (
            <p className="text-sm text-destructive" role="alert">
              {transferError}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="transfer-deck-from-ws">From workspace</Label>
            <Select
              value={transferFromTeamId}
              onValueChange={(v) => v != null && setTransferFromTeamId(v)}
            >
              <SelectTrigger id="transfer-deck-from-ws" className="w-full max-w-md">
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

          {transferDeckOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No team decks in this workspace to move.
            </p>
          ) : transferToCandidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other workspace from the same subscriber to move decks into. Transfers are only
              allowed between teams owned by one subscriber.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="transfer-deck-id">Deck to move</Label>
                <Select
                  value={transferDeckId}
                  onValueChange={(v) => v != null && setTransferDeckId(v)}
                >
                  <SelectTrigger id="transfer-deck-id" className="w-full max-w-md">
                    <SelectValue placeholder={PLACEHOLDER_TR_DECK}>
                      {(value) => {
                        if (value === TR_NO_DECK || value == null) {
                          return (
                            <span className="text-muted-foreground">{PLACEHOLDER_TR_DECK}</span>
                          );
                        }
                        const d = transferDeckOptions.find((x) => String(x.id) === String(value));
                        return (
                          d?.name ?? (
                            <span className="text-muted-foreground">{PLACEHOLDER_TR_DECK}</span>
                          )
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TR_NO_DECK} className="text-muted-foreground">
                      {PLACEHOLDER_TR_DECK}
                    </SelectItem>
                    {transferDeckOptions.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        <span className="truncate">{d.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transfer-deck-to-ws">Destination workspace</Label>
                <Select
                  value={transferToTeamId}
                  onValueChange={(v) => v != null && setTransferToTeamId(v)}
                >
                  <SelectTrigger id="transfer-deck-to-ws" className="w-full max-w-md">
                    <SelectValue placeholder={PLACEHOLDER_TR_TO}>
                      {(value) => {
                        if (value === TR_NO_TO || value == null) {
                          return (
                            <span className="text-muted-foreground">{PLACEHOLDER_TR_TO}</span>
                          );
                        }
                        const w = transferToCandidates.find((t) => String(t.id) === String(value));
                        return (
                          w?.name ?? (
                            <span className="text-muted-foreground">{PLACEHOLDER_TR_TO}</span>
                          )
                        );
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TR_NO_TO} className="text-muted-foreground">
                      {PLACEHOLDER_TR_TO}
                    </SelectItem>
                    {transferToCandidates.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        <span className="truncate">{w.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant="secondary"
                disabled={!canTransferSubmit || transferBusy}
                onClick={() => void onTransferDeck()}
              >
                {transferBusy ? "Moving deck…" : "Move deck"}
              </Button>
            </>
          )}
        </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add another team workspace to move decks between them. Transfers only apply when you
            manage more than one workspace.
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
