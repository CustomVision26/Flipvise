"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleHelp,
  Loader2,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  sendLiveClassroomLobbyCodeInboxAction,
  setLiveClassroomSessionMemberLcAccessAction,
  updateLiveClassroomSessionSettingsAction,
  updateLobbyTeamAction,
} from "@/actions/live-classroom";
import { getCardsForDeckViewerPreviewAction } from "@/actions/cards";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { LiveClassroomStrategyCardConfigDialog } from "@/components/live-classroom-strategy-card-config-dialog";
import {
  DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG,
  LIVE_CLASSROOM_BATTLE_MODES,
  LIVE_CLASSROOM_BATTLE_START_DELAY_OPTIONS_SEC,
  LIVE_CLASSROOM_QUESTION_SOURCE_MODES,
  LIVE_CLASSROOM_SESSION_TYPES,
  LIVE_CLASSROOM_STRATEGY_CARD_POLICIES,
  LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES,
  LIVE_CLASSROOM_TIME_PER_QUESTION_OPTIONS_SEC,
  battleModeLabel,
  battleStartDelayLabel,
  defaultStrategyCardSetting,
  deriveStrategyCardPolicy,
  sessionTypeLabel,
  strategyCardEnabledKinds,
  strategyCardLabel,
  strategyCardsForBattleMode,
  strategyCardsForTimerState,
  timePerQuestionLabel,
  type LiveClassroomBattleMode,
  type LiveClassroomQuestionSourceMode,
  type LiveClassroomSessionConfig,
  type LiveClassroomSessionType,
  type LiveClassroomStrategyCardKind,
  type LiveClassroomStrategyCardPolicy,
  type LiveClassroomStrategyCardSetting,
  type LiveClassroomStrategyCardSettings,
  type LiveClassroomTeamAssignmentMode,
} from "@/lib/live-classroom-types";
import { cn } from "@/lib/utils";

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

type DeckCardPreview = {
  id: number;
  front: string | null;
  back: string | null;
  cardType: string;
  choices: string[] | null;
  correctChoiceIndex: number | null;
};

const CAPTION_QUESTION_SOURCE =
  "Use every card in the deck as a question, or hand-pick specific deck cards for this battle. Changing this rebuilds the question set — safe before the battle starts.";

function syncCardSettingsToCount(
  settings: LiveClassroomStrategyCardSettings,
  count: number,
  available: LiveClassroomStrategyCardKind[],
): LiveClassroomStrategyCardSettings {
  const max = available.length;
  const n = Math.max(0, Math.min(Number.isFinite(count) ? count : 0, max));
  const enabled = strategyCardEnabledKinds(settings, available);
  let target: LiveClassroomStrategyCardKind[];
  if (n <= enabled.length) {
    target = enabled.slice(0, n);
  } else {
    target = [...enabled];
    for (const kind of available) {
      if (target.length >= n) break;
      if (!target.includes(kind)) target.push(kind);
    }
  }
  const out: LiveClassroomStrategyCardSettings = { ...settings };
  for (const kind of available) {
    const inTarget = target.includes(kind);
    const existing = out[kind] ?? defaultStrategyCardSetting(kind);
    out[kind] = {
      ...existing,
      scope: inTarget
        ? existing.scope === "disabled"
          ? "all"
          : existing.scope
        : "disabled",
    };
  }
  return out;
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
  /** When true, settings cannot be opened (e.g. another session is live). */
  disabled?: boolean;
  disabledReason?: string;
  session: {
    name: string;
    sessionType: LiveClassroomSessionType;
    battleMode: LiveClassroomBattleMode;
    config: LiveClassroomSessionConfig;
  };
  /** Linked deck id, used to list questions for individual strategy-card scoping. */
  deckId?: number | null;
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
  disabled = false,
  disabledReason,
  session,
  deckId = null,
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
  const [questionSourceMode, setQuestionSourceMode] =
    useState<LiveClassroomQuestionSourceMode>(
      session.config.questionSourceMode ?? "all",
    );
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>(
    session.config.selectedDeckCardIds ?? [],
  );
  const [deckCards, setDeckCards] = useState<DeckCardPreview[]>([]);
  const [loadingDeckCards, setLoadingDeckCards] = useState(false);
  const [timePerQuestionSec, setTimePerQuestionSec] = useState(
    session.config.timePerQuestionSec,
  );
  const [teamCount, setTeamCount] = useState(() =>
    Math.min(4, Math.max(2, teams.length || 4)),
  );
  const [teamAssignment, setTeamAssignment] = useState(
    session.config.teamAssignment,
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
  const [cardSettings, setCardSettings] = useState<LiveClassroomStrategyCardSettings>(
    () => {
      const available = strategyCardsForBattleMode(session.battleMode);
      const out: LiveClassroomStrategyCardSettings = {};
      for (const k of available) {
        out[k] = session.config.strategyCardSettings?.[k] ?? {
          ...defaultStrategyCardSetting(k),
          scope: (session.config.enabledStrategyCards?.length
            ? session.config.enabledStrategyCards.includes(k)
            : true)
            ? "all"
            : "disabled",
        };
      }
      return out;
    },
  );
  const [configuringKind, setConfiguringKind] =
    useState<LiveClassroomStrategyCardKind | null>(null);

  const availableStrategyCards = strategyCardsForBattleMode(battleMode);
  // Extra Time can't run without a per-question clock — exclude it from the
  // "available" set (and thus policy math) whenever the timer is off.
  const timeAwareAvailableStrategyCards = strategyCardsForTimerState(
    availableStrategyCards,
    timePerQuestionSec,
  );
  const enabledCards = strategyCardsForTimerState(
    strategyCardEnabledKinds(cardSettings, availableStrategyCards),
    timePerQuestionSec,
  );
  const strategyCardPolicy = deriveStrategyCardPolicy(
    enabledCards,
    timeAwareAvailableStrategyCards,
  );
  const strategyDetailsLocked = strategyCardPolicy === "disabled";
  const strategyCardsEditable = strategyCardPolicy !== "disabled";

  useEffect(() => {
    if (!open || deckId == null) return;
    let cancelled = false;
    setLoadingDeckCards(true);
    getCardsForDeckViewerPreviewAction({ deckId })
      .then((rows) => {
        if (cancelled) return;
        setDeckCards(
          rows.map((r) => ({
            id: r.id,
            front: r.front,
            back: r.back,
            cardType: r.cardType,
            choices: r.choices ?? null,
            correctChoiceIndex: r.correctChoiceIndex ?? null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) toast.error("Could not load deck cards");
      })
      .finally(() => {
        if (!cancelled) setLoadingDeckCards(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, deckId]);

  const effectiveCardCount =
    questionSourceMode === "specific" ? selectedCardIds.length : deckCards.length;

  function toggleCardId(id: number, checked: boolean) {
    setSelectedCardIds((prev) => {
      const already = prev.includes(id);
      if (checked) return already ? prev : [...prev, id];
      return already ? prev.filter((existing) => existing !== id) : prev;
    });
  }

  function hydrateSessionFormFromProps() {
    setName(session.name);
    setSessionType(session.sessionType);
    setBattleMode(session.battleMode);
    setBattleStartDelaySec(
      session.config.battleStartDelaySec ??
        DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.battleStartDelaySec,
    );
    setQuestionSourceMode(session.config.questionSourceMode ?? "all");
    setSelectedCardIds(session.config.selectedDeckCardIds ?? []);
    setTimePerQuestionSec(session.config.timePerQuestionSec);
    setTeamCount(Math.min(4, Math.max(2, teams.length || 4)));
    setTeamAssignment(session.config.teamAssignment);
    setSurvivalHearts(session.config.survivalHearts);
    setAllowAiExplanations(session.config.allowAiExplanations);
    setAllowStrategyCards(session.config.allowStrategyCards);
    setAllowMusic(session.config.allowMusic);
    const available = strategyCardsForBattleMode(session.battleMode);
    const out: LiveClassroomStrategyCardSettings = {};
    for (const k of available) {
      out[k] = session.config.strategyCardSettings?.[k] ?? {
        ...defaultStrategyCardSetting(k),
        scope:
          session.config.strategyCardPolicy === "disabled"
            ? "disabled"
            : session.config.enabledStrategyCards?.length
              ? session.config.enabledStrategyCards.includes(k)
                ? "all"
                : "disabled"
              : "all",
      };
    }
    setCardSettings(out);
    setStrategyCardLimitPerTeam(
      session.config.strategyCardPolicy === "unlimited"
        ? available.length
        : session.config.strategyCardLimitPerTeam,
    );
  }

  function setBattleModeAndCards(nextMode: LiveClassroomBattleMode) {
    const available = strategyCardsForBattleMode(nextMode);
    setBattleMode(nextMode);
    setCardSettings((prev) => {
      const next = { ...prev };
      for (const k of available) {
        if (!next[k]) next[k] = defaultStrategyCardSetting(k);
      }
      return next;
    });
  }

  function applyStrategyCardPolicy(next: LiveClassroomStrategyCardPolicy) {
    setCardSettings((prev) => {
      const out = { ...prev };
      if (next === "unlimited") {
        for (const k of timeAwareAvailableStrategyCards) {
          out[k] = { ...(out[k] ?? defaultStrategyCardSetting(k)), scope: "all" };
        }
        setStrategyCardLimitPerTeam(timeAwareAvailableStrategyCards.length);
        return out;
      }
      if (next === "disabled") {
        for (const k of availableStrategyCards) {
          out[k] = { ...(out[k] ?? defaultStrategyCardSetting(k)), scope: "disabled" };
        }
        setStrategyCardLimitPerTeam(0);
        return out;
      }
      const currentlyEnabled = strategyCardEnabledKinds(
        out,
        timeAwareAvailableStrategyCards,
      );
      let nextEnabledCount = currentlyEnabled.length;
      if (
        currentlyEnabled.length === 0 ||
        currentlyEnabled.length === timeAwareAvailableStrategyCards.length
      ) {
        for (const k of timeAwareAvailableStrategyCards) {
          out[k] = { ...(out[k] ?? defaultStrategyCardSetting(k)), scope: "all" };
        }
        const last =
          timeAwareAvailableStrategyCards[
            timeAwareAvailableStrategyCards.length - 1
          ];
        if (last) out[last] = { ...out[last]!, scope: "disabled" };
        nextEnabledCount = Math.max(1, timeAwareAvailableStrategyCards.length - 1);
      }
      setStrategyCardLimitPerTeam(nextEnabledCount);
      return out;
    });
  }

  function setCardsPerTeamCount(count: number) {
    setCardSettings((prev) => {
      const next = syncCardSettingsToCount(
        prev,
        count,
        timeAwareAvailableStrategyCards,
      );
      setStrategyCardLimitPerTeam(
        strategyCardEnabledKinds(next, timeAwareAvailableStrategyCards).length,
      );
      return next;
    });
  }

  function saveCardSetting(
    kind: LiveClassroomStrategyCardKind,
    setting: LiveClassroomStrategyCardSetting,
  ) {
    setCardSettings((prev) => {
      const next = { ...prev, [kind]: setting };
      setStrategyCardLimitPerTeam(
        strategyCardEnabledKinds(next, availableStrategyCards).length,
      );
      return next;
    });
  }

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
    if (questionSourceMode === "specific" && selectedCardIds.length === 0) {
      toast.error("Select at least one card for this battle.");
      return;
    }
    startTransition(async () => {
      try {
        await updateLiveClassroomSessionSettingsAction({
          sessionId,
          name,
          sessionType,
          battleMode,
          battleStartDelaySec,
          questionSourceMode,
          selectedDeckCardIds:
            questionSourceMode === "specific" ? selectedCardIds : undefined,
          timePerQuestionSec,
          teamCount,
          teamAssignment,
          strategyCardPolicy: allowStrategyCards ? strategyCardPolicy : "disabled",
          strategyCardLimitPerTeam: !allowStrategyCards
            ? 0
            : strategyCardPolicy === "unlimited"
              ? timeAwareAvailableStrategyCards.length
              : enabledCards.length,
          enabledStrategyCards: !allowStrategyCards ? [] : enabledCards,
          strategyCardSettings: allowStrategyCards ? cardSettings : undefined,
          survivalHearts:
            battleMode === "survival" ? survivalHearts : undefined,
          allowAiExplanations,
          allowStrategyCards,
          allowMusic,
        });
        toast.success("Session settings saved");
        router.refresh();
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
        disabled={disabled}
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={disabled}
            title={disabled ? disabledReason : undefined}
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
                        setBattleModeAndCards(v as LiveClassroomBattleMode)
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
                    <div className="flex items-center gap-1.5">
                      <Label>Card count</Label>
                      <FieldHint
                        label="Card count"
                        caption="Automatically matches the cards included in this battle below — every deck card becomes one question."
                      />
                    </div>
                    <div className="flex h-9 items-center rounded-md border border-input bg-muted/20 px-3 text-sm text-foreground">
                      {loadingDeckCards ? (
                        <Loader2
                          className="size-3.5 animate-spin text-muted-foreground"
                          aria-hidden
                        />
                      ) : (
                        <span>
                          {effectiveCardCount} card
                          {effectiveCardCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="lc-sess-time">Seconds per question</Label>
                      <FieldHint
                        label="Seconds per question"
                        caption="Countdown timer for each question, or turn it off for an untimed battle."
                      />
                    </div>
                    <Select
                      value={
                        timePerQuestionSec == null
                          ? "off"
                          : String(timePerQuestionSec)
                      }
                      onValueChange={(v) => {
                        if (v == null) return;
                        setTimePerQuestionSec(v === "off" ? null : Number(v));
                      }}
                    >
                      <SelectTrigger id="lc-sess-time" className="w-full">
                        <SelectValue>
                          {timePerQuestionLabel(timePerQuestionSec)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off">No time limit</SelectItem>
                        {LIVE_CLASSROOM_TIME_PER_QUESTION_OPTIONS_SEC.map(
                          (sec) => (
                            <SelectItem key={sec} value={String(sec)}>
                              {timePerQuestionLabel(sec)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor="lc-sess-teams">Team count</Label>
                      <FieldHint
                        label="Team count"
                        caption="Number of competing teams in the lobby (2–4). Unlock teams before changing this. Not used in Survival — every player battles individually."
                      />
                    </div>
                    <Input
                      id="lc-sess-teams"
                      type="number"
                      min={2}
                      max={4}
                      value={teamCount}
                      disabled={teamsLocked || battleMode === "survival"}
                      title={
                        battleMode === "survival"
                          ? "Survival is every player for themselves — team count doesn't apply."
                          : teamsLocked
                            ? "Unlock teams before changing team count"
                            : undefined
                      }
                      onChange={(e) => setTeamCount(Number(e.target.value))}
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

              {deckId != null ? (
                <section className="space-y-2.5 rounded-lg border border-border/60 bg-muted/10 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Label>Cards to include in this battle</Label>
                      <FieldHint
                        label="Cards to include in this battle"
                        caption={CAPTION_QUESTION_SOURCE}
                      />
                    </div>
                    <Select
                      value={questionSourceMode}
                      onValueChange={(v) => {
                        if (v != null)
                          setQuestionSourceMode(
                            v as LiveClassroomQuestionSourceMode,
                          );
                      }}
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LIVE_CLASSROOM_QUESTION_SOURCE_MODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m === "all"
                              ? "All cards in the deck"
                              : "Select specific cards"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {questionSourceMode === "specific" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {selectedCardIds.length > 0
                          ? `${selectedCardIds.length} card${selectedCardIds.length === 1 ? "" : "s"} selected. Check the cards below to include as questions.`
                          : "Check the cards below to include as questions."}
                      </p>
                      {loadingDeckCards ? (
                        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-card/40 px-3 py-4 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Loading deck cards…
                        </div>
                      ) : deckCards.length === 0 ? (
                        <p className="rounded-md border border-border/50 bg-card/40 px-3 py-4 text-xs text-muted-foreground">
                          This deck has no cards yet.
                        </p>
                      ) : (
                        <ScrollArea className="h-56 rounded-md border border-border/50 bg-card/40">
                          <div className="space-y-2 p-2">
                            {deckCards.map((card) => {
                              const checked = selectedCardIds.includes(card.id);
                              const isMc =
                                card.cardType === "multiple_choice" &&
                                Array.isArray(card.choices) &&
                                card.choices.length > 0;
                              return (
                                <div
                                  key={card.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => toggleCardId(card.id, !checked)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      toggleCardId(card.id, !checked);
                                    }
                                  }}
                                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border/40 bg-background/40 p-2 transition-colors hover:bg-background/70"
                                >
                                  <Checkbox
                                    checked={checked}
                                    tabIndex={-1}
                                    className="mt-0.5 pointer-events-none"
                                  />
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <p className="text-sm font-medium text-foreground">
                                      {card.front?.trim() || "Untitled question"}
                                    </p>
                                    {isMc ? (
                                      <ul className="space-y-0.5">
                                        {card.choices!.map((choice, i) => (
                                          <li
                                            key={i}
                                            className={cn(
                                              "flex items-center gap-1 text-xs",
                                              i === card.correctChoiceIndex
                                                ? "text-emerald-400"
                                                : "text-muted-foreground",
                                            )}
                                          >
                                            {i === card.correctChoiceIndex ? (
                                              <Check
                                                className="size-3 shrink-0"
                                                aria-hidden
                                              />
                                            ) : (
                                              <X
                                                className="size-3 shrink-0"
                                                aria-hidden
                                              />
                                            )}
                                            <span className="truncate">{choice}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">
                                        Correct answer: {card.back?.trim() || "—"}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {loadingDeckCards
                        ? "Loading deck cards…"
                        : `All ${deckCards.length} card${deckCards.length === 1 ? "" : "s"} in this deck will be used as questions.`}
                    </p>
                  )}
                </section>
              ) : null}

              {allowStrategyCards ? (
                <section className="space-y-4 rounded-xl border border-border/70 bg-card/40 p-4 shadow-sm">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label>Strategy card policy</Label>
                        <FieldHint
                          label="Strategy card policy"
                          caption="Unlimited = every card for this battle mode. Limited = some off. Disabled = none. Survival mode adds Shield and Recovery."
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
                          caption="Matches how many strategy card types are selected below for this battle mode."
                        />
                      </div>
                      <Input
                        id="lc-sess-cards"
                        type="number"
                        min={0}
                        max={timeAwareAvailableStrategyCards.length}
                        value={
                          strategyCardPolicy === "unlimited"
                            ? timeAwareAvailableStrategyCards.length
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

                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Label>Strategy cards available</Label>
                      <FieldHint
                        label="Strategy cards available"
                        caption="Click a card to choose which questions it applies to, its score/time value, and its per-team activation cap. Individual and Collaborative hide Shield and Recovery."
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableStrategyCards.map((kind) => {
                        const setting =
                          cardSettings[kind] ?? defaultStrategyCardSetting(kind);
                        const timerBlocked =
                          kind === "extra_time" && timePerQuestionSec == null;
                        const on = !timerBlocked && setting.scope !== "disabled";
                        return (
                          <Button
                            key={kind}
                            type="button"
                            size="sm"
                            variant={on ? "default" : "outline"}
                            className={cn(
                              "rounded-full",
                              timerBlocked && "opacity-40",
                            )}
                            aria-pressed={on}
                            disabled={timerBlocked}
                            title={
                              timerBlocked
                                ? "Enable a question timer to use Extra Time"
                                : undefined
                            }
                            onClick={() => {
                              if (timerBlocked) return;
                              setConfiguringKind(kind);
                            }}
                          >
                            {strategyCardLabel(kind)}
                            {on && setting.scope === "individual"
                              ? ` · ${setting.cardIds.length}q`
                              : ""}
                          </Button>
                        );
                      })}
                    </div>
                    {enabledCards.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No cards enabled — click a card above to turn it back
                        on.
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

      <LiveClassroomStrategyCardConfigDialog
        open={configuringKind != null}
        onOpenChange={(v) => {
          if (!v) setConfiguringKind(null);
        }}
        kind={configuringKind}
        deckId={deckId}
        allowedCardIds={
          questionSourceMode === "specific" ? selectedCardIds : null
        }
        setting={
          configuringKind
            ? cardSettings[configuringKind] ?? defaultStrategyCardSetting(configuringKind)
            : defaultStrategyCardSetting("double_points")
        }
        otherCardSettings={Object.fromEntries(
          enabledCards.map((k) => [k, cardSettings[k]!]),
        )}
        onSave={(setting) => {
          if (configuringKind) saveCardSetting(configuringKind, setting);
        }}
      />

    </Dialog>
  );
}
