"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Loader2, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  sendLiveClassroomLobbyCodeInboxAction,
  setLiveClassroomSessionMemberLcAccessAction,
  updateLiveClassroomSessionSettingsAction,
  updateLobbyTeamAction,
} from "@/actions/live-classroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG,
  LIVE_CLASSROOM_BATTLE_MODES,
  LIVE_CLASSROOM_BATTLE_START_DELAY_OPTIONS_SEC,
  LIVE_CLASSROOM_SESSION_TYPES,
  LIVE_CLASSROOM_STRATEGY_CARD_KINDS,
  LIVE_CLASSROOM_STRATEGY_CARD_POLICIES,
  LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES,
  battleModeLabel,
  battleStartDelayLabel,
  sessionTypeLabel,
  strategyCardLabel,
  type LiveClassroomBattleMode,
  type LiveClassroomSessionConfig,
  type LiveClassroomSessionType,
  type LiveClassroomStrategyCardKind,
  type LiveClassroomStrategyCardPolicy,
  type LiveClassroomTeamAssignmentMode,
} from "@/lib/live-classroom-types";

function FieldHint({ label, caption }: { label: string; caption: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`${label} help`}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{caption}</TooltipContent>
    </Tooltip>
  );
}

const UNASSIGNED = "__unassigned__";
const ALL_STRATEGY_CARD_KINDS = [...LIVE_CLASSROOM_STRATEGY_CARD_KINDS];

function syncEnabledCardsToCount(
  current: LiveClassroomStrategyCardKind[],
  count: number,
): LiveClassroomStrategyCardKind[] {
  const max = ALL_STRATEGY_CARD_KINDS.length;
  const n = Math.max(0, Math.min(Number.isFinite(count) ? count : 0, max));
  if (n <= current.length) return current.slice(0, n);
  const next = [...current];
  for (const kind of ALL_STRATEGY_CARD_KINDS) {
    if (next.length >= n) break;
    if (!next.includes(kind)) next.push(kind);
  }
  return next;
}

export type LiveClassroomWorkspaceMemberOption = {
  key: string;
  userId: string;
  displayName: string;
  roleLabel: "Owner" | "Team admin" | "Member";
};

type SessionSettingsParticipant = {
  id: number;
  userId: string;
  displayName: string;
  liveTeamId: number | null;
  connected: boolean;
};

type SessionSettingsTeam = {
  id: number;
  name: string;
};

type LiveClassroomSessionSettingsDialogProps = {
  sessionId: number;
  canHost: boolean;
  teamsLocked: boolean;
  ownerUserId: string;
  session: {
    name: string;
    sessionType: LiveClassroomSessionType;
    battleMode: LiveClassroomBattleMode;
    config: LiveClassroomSessionConfig;
  };
  teams: SessionSettingsTeam[];
  participants: SessionSettingsParticipant[];
  workspaceMembers?: LiveClassroomWorkspaceMemberOption[];
  /** User IDs with Live Classroom™ participant grants (owner is always treated as granted). */
  assignedUserIds?: string[];
  currentUserId: string;
};

function teamSelectLabel(
  value: string,
  teams: SessionSettingsTeam[],
): string {
  if (value === UNASSIGNED) return "Unassigned";
  return teams.find((t) => String(t.id) === value)?.name ?? "Unassigned";
}

export function LiveClassroomSessionSettingsDialog({
  sessionId,
  canHost,
  teamsLocked,
  ownerUserId,
  session,
  teams,
  participants,
  workspaceMembers = [],
  assignedUserIds = [],
  currentUserId,
}: LiveClassroomSessionSettingsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [memberPending, setMemberPending] = useState<string | null>(null);
  const [lcAccessByUserId, setLcAccessByUserId] = useState<
    Record<string, boolean>
  >({});
  const [sendConfirmUserId, setSendConfirmUserId] = useState<string | null>(
    null,
  );

  const [name, setName] = useState(session.name);
  const [sessionType, setSessionType] = useState(session.sessionType);
  const [battleMode, setBattleMode] = useState(session.battleMode);
  const [battleStartDelaySec, setBattleStartDelaySec] = useState(
    session.config.battleStartDelaySec ??
      DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.battleStartDelaySec,
  );
  const [questionCount, setQuestionCount] = useState(
    session.config.questionCount,
  );
  const [timePerQuestionSec, setTimePerQuestionSec] = useState(
    session.config.timePerQuestionSec,
  );
  const [teamAssignment, setTeamAssignment] = useState(
    session.config.teamAssignment,
  );
  const [strategyCardPolicy, setStrategyCardPolicy] = useState(
    session.config.strategyCardPolicy,
  );
  const [strategyCardLimitPerTeam, setStrategyCardLimitPerTeam] = useState(
    session.config.strategyCardLimitPerTeam,
  );
  const [survivalHearts, setSurvivalHearts] = useState(
    session.config.survivalHearts,
  );
  const [allowAiExplanations, setAllowAiExplanations] = useState(
    session.config.allowAiExplanations,
  );
  const [allowStrategyCards, setAllowStrategyCards] = useState(
    session.config.allowStrategyCards,
  );
  const [allowMusic, setAllowMusic] = useState(session.config.allowMusic);
  const [enabledCards, setEnabledCards] = useState<
    LiveClassroomStrategyCardKind[]
  >(
    session.config.enabledStrategyCards?.length
      ? session.config.enabledStrategyCards
      : [...DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.enabledStrategyCards],
  );

  function hydrateSessionFormFromProps() {
    setName(session.name);
    setSessionType(session.sessionType);
    setBattleMode(session.battleMode);
    setBattleStartDelaySec(
      session.config.battleStartDelaySec ??
        DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.battleStartDelaySec,
    );
    setQuestionCount(session.config.questionCount);
    setTimePerQuestionSec(session.config.timePerQuestionSec);
    setTeamAssignment(session.config.teamAssignment);
    setStrategyCardPolicy(session.config.strategyCardPolicy);
    setSurvivalHearts(session.config.survivalHearts);
    setAllowAiExplanations(session.config.allowAiExplanations);
    setAllowStrategyCards(session.config.allowStrategyCards);
    setAllowMusic(session.config.allowMusic);
    if (session.config.strategyCardPolicy === "unlimited") {
      setEnabledCards(ALL_STRATEGY_CARD_KINDS);
      setStrategyCardLimitPerTeam(ALL_STRATEGY_CARD_KINDS.length);
    } else {
      const cards = session.config.enabledStrategyCards?.length
        ? session.config.enabledStrategyCards
        : [...DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.enabledStrategyCards];
      setEnabledCards(cards);
      setStrategyCardLimitPerTeam(
        session.config.strategyCardPolicy === "limited"
          ? cards.length
          : session.config.strategyCardLimitPerTeam,
      );
    }
  }

  function applyStrategyCardPolicy(next: LiveClassroomStrategyCardPolicy) {
    setStrategyCardPolicy(next);
    if (next === "unlimited") {
      setEnabledCards(ALL_STRATEGY_CARD_KINDS);
      setStrategyCardLimitPerTeam(ALL_STRATEGY_CARD_KINDS.length);
      return;
    }
    if (next === "limited") {
      setEnabledCards((prev) => {
        const kept =
          prev.length > 0
            ? prev
            : ALL_STRATEGY_CARD_KINDS.slice(
                0,
                DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.strategyCardLimitPerTeam,
              );
        setStrategyCardLimitPerTeam(kept.length);
        return kept;
      });
    }
  }

  function setCardsPerTeamCount(count: number) {
    const next = syncEnabledCardsToCount(enabledCards, count);
    setEnabledCards(next);
    setStrategyCardLimitPerTeam(next.length);
  }

  function toggleStrategyCard(kind: LiveClassroomStrategyCardKind) {
    if (strategyCardPolicy !== "limited") return;
    setEnabledCards((prev) => {
      const next = prev.includes(kind)
        ? prev.filter((k) => k !== kind)
        : [...prev, kind];
      setStrategyCardLimitPerTeam(next.length);
      return next;
    });
  }

  const strategyDetailsLocked = strategyCardPolicy === "disabled";
  const strategyCardsEditable = strategyCardPolicy === "limited";

  function hydrateLcAccessFromProps() {
    const assigned = new Set(assignedUserIds);
    const next: Record<string, boolean> = {};
    for (const member of workspaceMembers) {
      next[member.userId] = assigned.has(member.userId);
    }
    setLcAccessByUserId(next);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      // Lobby realtime polls rewrite `session` every few seconds. Hydrate only
      // when opening so in-progress edits are not wiped before Save.
      hydrateSessionFormFromProps();
      hydrateLcAccessFromProps();
    }
    setOpen(next);
  }

  if (!canHost) return null;

  async function toggleLcAccess(userId: string, enabled: boolean) {
    const previous = lcAccessByUserId[userId] ?? false;
    setLcAccessByUserId((prev) => ({ ...prev, [userId]: enabled }));
    setMemberPending(userId);
    try {
      await setLiveClassroomSessionMemberLcAccessAction({
        sessionId,
        memberUserId: userId,
        enabled,
      });
      toast.success(
        enabled
          ? "Live Classroom access granted"
          : "Live Classroom access revoked",
      );
      router.refresh();
    } catch (err) {
      setLcAccessByUserId((prev) => ({ ...prev, [userId]: previous }));
      toast.error(
        err instanceof Error ? err.message : "Could not update access",
      );
    } finally {
      setMemberPending(null);
    }
  }

  async function confirmSendLobbyCode() {
    if (sendConfirmUserId == null) return;
    const userId = sendConfirmUserId;
    setSendConfirmUserId(null);
    setMemberPending(userId);
    try {
      await sendLiveClassroomLobbyCodeInboxAction({
        sessionId,
        memberUserId: userId,
      });
      setLcAccessByUserId((prev) => ({ ...prev, [userId]: true }));
      toast.success("Lobby code sent to inbox");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send lobby code",
      );
    } finally {
      setMemberPending(null);
    }
  }

  function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateLiveClassroomSessionSettingsAction({
          sessionId,
          name,
          sessionType,
          battleMode,
          battleStartDelaySec,
          questionCount,
          timePerQuestionSec,
          teamAssignment,
          strategyCardPolicy: allowStrategyCards
            ? strategyCardPolicy
            : "disabled",
          strategyCardLimitPerTeam:
            strategyCardPolicy === "unlimited"
              ? ALL_STRATEGY_CARD_KINDS.length
              : strategyCardLimitPerTeam,
          enabledStrategyCards: !allowStrategyCards
            ? []
            : strategyCardPolicy === "unlimited"
              ? ALL_STRATEGY_CARD_KINDS
              : strategyCardPolicy === "disabled"
                ? []
                : enabledCards,
          survivalHearts:
            battleMode === "survival" ? survivalHearts : undefined,
          allowAiExplanations,
          allowStrategyCards,
          allowMusic,
        });
        toast.success("Session settings saved");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save settings",
        );
      }
    });
  }

  async function moveMember(userId: string, value: string) {
    setMemberPending(userId);
    try {
      await updateLobbyTeamAction({
        sessionId,
        moveUserId: userId,
        toLiveTeamId: value === UNASSIGNED ? null : Number(value),
      });
      toast.success("Member moved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not move member",
      );
    } finally {
      setMemberPending(null);
    }
  }

  async function removeMember(userId: string, displayName: string) {
    setMemberPending(userId);
    try {
      await updateLobbyTeamAction({
        sessionId,
        removeUserId: userId,
      });
      toast.success(`${displayName} removed from session`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not remove member",
      );
    } finally {
      setMemberPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            aria-label="Session settings"
          />
        }
      >
        <Settings className="size-3.5" aria-hidden />
        Settings
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,48rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Session settings</DialogTitle>
          <DialogDescription>
            Update this session’s battle options and manage who is on each
            team. Changes apply only to this lobby.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="session">
          <TabsList className="w-full">
            <TabsTrigger value="session" className="flex-1">
              Session
            </TabsTrigger>
            <TabsTrigger value="members" className="flex-1">
              Members
            </TabsTrigger>
          </TabsList>

          <TabsContent value="session" className="mt-4 space-y-4">
            <form onSubmit={saveSettings} className="space-y-5">
              <section className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="lc-sess-name">Session name</Label>
                  <Input
                    id="lc-sess-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={255}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Session type</Label>
                    <Select
                      value={sessionType}
                      onValueChange={(v) =>
                        setSessionType(v as LiveClassroomSessionType)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIVE_CLASSROOM_SESSION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {sessionTypeLabel(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Battle mode</Label>
                    <Select
                      value={battleMode}
                      onValueChange={(v) =>
                        setBattleMode(v as LiveClassroomBattleMode)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIVE_CLASSROOM_BATTLE_MODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {battleModeLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label>Start time</Label>
                      <FieldHint
                        label="Start time"
                        caption="Countdown after Start battle before questions begin (60 seconds to 5 minutes)."
                      />
                    </div>
                    <Select
                      value={String(battleStartDelaySec)}
                      onValueChange={(v) => {
                        if (v != null) setBattleStartDelaySec(Number(v));
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {battleStartDelayLabel(battleStartDelaySec)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {LIVE_CLASSROOM_BATTLE_START_DELAY_OPTIONS_SEC.map(
                          (sec) => (
                            <SelectItem key={sec} value={String(sec)}>
                              {battleStartDelayLabel(sec)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Team assignment</Label>
                    <Select
                      value={teamAssignment}
                      onValueChange={(v) =>
                        setTeamAssignment(
                          v as LiveClassroomTeamAssignmentMode,
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m === "manual"
                              ? "Manual"
                              : m === "random"
                                ? "Random"
                                : "Saved groups"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lc-sess-q">Questions</Label>
                    <Input
                      id="lc-sess-q"
                      type="number"
                      min={1}
                      max={30}
                      value={questionCount}
                      onChange={(e) =>
                        setQuestionCount(Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lc-sess-time">Seconds per question</Label>
                    <Input
                      id="lc-sess-time"
                      type="number"
                      min={5}
                      max={180}
                      value={timePerQuestionSec}
                      onChange={(e) =>
                        setTimePerQuestionSec(Number(e.target.value))
                      }
                    />
                  </div>
                  {battleMode === "survival" ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="lc-sess-hearts">Survival hearts</Label>
                      <Input
                        id="lc-sess-hearts"
                        type="number"
                        min={1}
                        max={5}
                        value={survivalHearts}
                        onChange={(e) =>
                          setSurvivalHearts(Number(e.target.value))
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                  <span className="text-sm text-foreground">
                    AI explanations
                  </span>
                  <Switch
                    checked={allowAiExplanations}
                    onCheckedChange={setAllowAiExplanations}
                  />
                </label>
                <label className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                  <span className="text-sm text-foreground">Strategy cards</span>
                  <Switch
                    checked={allowStrategyCards}
                    onCheckedChange={setAllowStrategyCards}
                  />
                </label>
                <label className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                  <span className="text-sm text-foreground">Battle music</span>
                  <Switch
                    checked={allowMusic}
                    onCheckedChange={setAllowMusic}
                  />
                </label>
              </section>

              {allowStrategyCards ? (
                <section className="space-y-4 rounded-xl border border-border/70 bg-card/40 p-4 shadow-sm">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label>Strategy card policy</Label>
                        <FieldHint
                          label="Strategy card policy"
                          caption="Disabled greys out card limits and the available set. Unlimited enables every strategy card. Limited lets you choose how many cards each team gets."
                        />
                      </div>
                      <Select
                        value={strategyCardPolicy}
                        onValueChange={(v) => {
                          if (v != null) {
                            applyStrategyCardPolicy(
                              v as LiveClassroomStrategyCardPolicy,
                            );
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LIVE_CLASSROOM_STRATEGY_CARD_POLICIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div
                      className={
                        strategyDetailsLocked
                          ? "space-y-2 opacity-50"
                          : "space-y-2"
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="lc-sess-cards">Cards per team</Label>
                        <FieldHint
                          label="Cards per team"
                          caption="Matches how many strategy card types are selected below. Editable when policy is Limited."
                        />
                      </div>
                      <Input
                        id="lc-sess-cards"
                        type="number"
                        min={0}
                        max={ALL_STRATEGY_CARD_KINDS.length}
                        value={
                          strategyCardPolicy === "unlimited"
                            ? ALL_STRATEGY_CARD_KINDS.length
                            : strategyCardLimitPerTeam
                        }
                        disabled={!strategyCardsEditable}
                        aria-disabled={strategyDetailsLocked}
                        onChange={(e) =>
                          setCardsPerTeamCount(Number(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div
                    className={
                      strategyDetailsLocked
                        ? "space-y-2 opacity-50"
                        : "space-y-2"
                    }
                    aria-disabled={strategyDetailsLocked}
                  >
                    <div className="flex items-center gap-1.5">
                      <Label>Strategy cards available</Label>
                      <FieldHint
                        label="Strategy cards available"
                        caption="Unlimited shows every card. Limited lets you pick types; the count stays in sync with Cards per team. Disabled greys this out."
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {LIVE_CLASSROOM_STRATEGY_CARD_KINDS.map((kind) => {
                        const on =
                          strategyCardPolicy === "unlimited" ||
                          enabledCards.includes(kind);
                        return (
                          <Button
                            key={kind}
                            type="button"
                            size="sm"
                            variant={on ? "default" : "outline"}
                            className="rounded-full"
                            aria-pressed={on}
                            disabled={!strategyCardsEditable}
                            onClick={() => toggleStrategyCard(kind)}
                          >
                            {strategyCardLabel(kind)}
                          </Button>
                        );
                      })}
                    </div>
                    {strategyCardsEditable && enabledCards.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Select at least one card type, or set policy to
                        Disabled / Unlimited.
                      </p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <DialogFooter className="px-0 pb-0">
                <Button type="submit" disabled={pending} className="gap-2">
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save settings
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="members" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Workspace members only (pending invitees are not listed). Grant
              Live Classroom™ access, then send the lobby code by formal inbox
              message. People already in the lobby can be moved between teams or
              removed from this session.
              {teamsLocked
                ? " Unlock teams in the lobby before moving members."
                : null}
            </p>
            {workspaceMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No workspace members yet.
              </p>
            ) : (
              workspaceMembers.map((member) => {
                const participant = participants.find(
                  (p) => p.userId === member.userId,
                );
                const inLobby = Boolean(participant);
                const busy = memberPending === member.userId;
                const isOwner = member.userId === ownerUserId;
                const hasLcAccess = Boolean(lcAccessByUserId[member.userId]);
                const teamValue =
                  participant == null || participant.liveTeamId == null
                    ? UNASSIGNED
                    : String(participant.liveTeamId);
                return (
                  <div key={member.key}>
                    <div className="flex flex-col gap-3 rounded-md border border-border/40 px-3 py-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {member.displayName}
                            {member.userId === currentUserId ? " (you)" : ""}
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {member.roleLabel}
                            </span>
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {inLobby ? (
                              <Badge
                                variant={
                                  participant?.connected ? "default" : "outline"
                                }
                                className="text-[10px]"
                              >
                                {participant?.connected
                                  ? "In lobby · Online"
                                  : "In lobby · Away"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                Not in lobby
                              </Badge>
                            )}
                            {hasLcAccess ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                LC access
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        {inLobby && participant ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={teamValue}
                              disabled={busy || teamsLocked}
                              onValueChange={(v) => {
                                if (v != null)
                                  void moveMember(member.userId, v);
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue>
                                  {(value) =>
                                    teamSelectLabel(
                                      value == null
                                        ? UNASSIGNED
                                        : String(value),
                                      teams,
                                    )
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={UNASSIGNED}>
                                  Unassigned
                                </SelectItem>
                                {teams.map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              disabled={busy}
                              aria-label={`Remove ${member.displayName}`}
                              onClick={() =>
                                void removeMember(
                                  member.userId,
                                  member.displayName,
                                )
                              }
                            >
                              {busy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" aria-hidden />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Join with code to enter lobby
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 border-t border-border/30 pt-2 sm:flex-row sm:items-center sm:justify-between">
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <Switch
                            checked={hasLcAccess}
                            disabled={busy}
                            onCheckedChange={(checked) =>
                              void toggleLcAccess(member.userId, checked)
                            }
                            aria-label={`Grant Live Classroom access to ${member.displayName}`}
                          />
                          <span className="text-xs sm:text-sm">
                            Grant access to LC
                          </span>
                        </label>
                        {hasLcAccess && !isOwner ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            className="gap-1.5"
                            onClick={() => setSendConfirmUserId(member.userId)}
                          >
                            {busy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : null}
                            Send lobby code
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <Separator className="my-2 bg-border/40 last:hidden" />
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog
        open={sendConfirmUserId != null}
        onOpenChange={(open) => {
          if (!open) setSendConfirmUserId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send lobby code?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends a formal inbox message with the session name (
              {session.name}), session type ({sessionTypeLabel(sessionType)}),
              battle mode ({battleModeLabel(battleMode)}), a note that they will
              be on a team, the lobby join code, and instructions to enter the
              code on the study page or via Live Classroom → Join with code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmSendLobbyCode()}>
              Agree and send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
