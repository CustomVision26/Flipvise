"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createLiveClassroomSessionAction } from "@/actions/live-classroom";
import { getCardsForDeckViewerPreviewAction } from "@/actions/cards";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
  type LiveClassroomSessionType,
  type LiveClassroomStrategyCardKind,
  type LiveClassroomStrategyCardPolicy,
  type LiveClassroomStrategyCardSetting,
  type LiveClassroomStrategyCardSettings,
  type LiveClassroomTeamAssignmentMode,
} from "@/lib/live-classroom-types";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_ROOT_PATH,
  liveClassroomLobbyPath,
} from "@/lib/live-classroom-url";

export type LiveClassroomDeckOption = {
  id: number;
  name: string;
};

type DeckCardPreview = {
  id: number;
  front: string | null;
  back: string | null;
  cardType: string;
  choices: string[] | null;
  correctChoiceIndex: number | null;
};

const CAPTION_SESSION_NAME =
  "Title shown in the lobby and host controls so students and teachers can recognize this battle.";
const CAPTION_SESSION_TYPE =
  "Choose the battle format — team battle, warm-up, review, and other Live Classroom™ session styles.";
const CAPTION_BATTLE_MODE =
  "How teams compete: individual scoring within teams, captain-led play, or survival with hearts.";
const CAPTION_START_TIME =
  "Countdown after Start battle before questions begin (60 seconds to 5 minutes).";
const CAPTION_TEAM_ASSIGNMENT =
  "How students are placed on teams — random, manual in the lobby, or from saved groups.";
const CAPTION_QUESTION_SOURCE =
  "Use every card in the deck as a question, or hand-pick specific deck cards to include in this battle.";
const CAPTION_QUESTION_PICKER =
  "Check the deck cards to include as questions in this battle. Strategy cards can then target these same questions.";
const CAPTION_SECONDS =
  "Countdown timer for each question before the round advances, or turn it off for an untimed battle.";
const CAPTION_TEAM_COUNT =
  "Number of competing teams created in the lobby (2–4).";
const CAPTION_SURVIVAL_HEARTS =
  "Lives each team starts with in Survival mode. Wrong answers cost hearts.";
const CAPTION_SCHEDULE =
  "Optional start time. Leave blank to open the lobby immediately; set a time to schedule the session.";
const CAPTION_DECK =
  "Pick a deck already linked to this workspace. Its cards are used to build this session's questions.";
const CAPTION_AI_EXPLANATIONS =
  "After answers, show AI explanations for the correct choice and common wrong answers.";
const CAPTION_STRATEGY_CARDS =
  "Give teams power-up cards (extra time, 50/50, shield, and more) during the battle.";
const CAPTION_BATTLE_MUSIC =
  "Play background battle music during the live session when enabled for this workspace.";
const CAPTION_STRATEGY_POLICY =
  "Unlimited = every card for this battle mode is on. Limited = some cards off. Disabled = none selected.";
const CAPTION_STRATEGY_KINDS =
  "Cards depend on battle mode. Survival adds Shield and Recovery. Click a card to choose which questions it applies to, its score/time value, and how many times a team can use it.";

function HintBalloon({
  fieldLabel,
  caption,
}: {
  fieldLabel: string;
  caption: string;
}) {
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

function FieldLabel({
  htmlFor,
  label,
  caption,
}: {
  htmlFor?: string;
  label: string;
  caption: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      <HintBalloon fieldLabel={label} caption={caption} />
    </div>
  );
}

type LiveClassroomStartFormProps = {
  teamId: number;
  decks: LiveClassroomDeckOption[];
  defaults?: {
    defaultBattleType?: LiveClassroomSessionType;
    allowMusic?: boolean;
    allowStrategyCards?: boolean;
    allowAiExplanations?: boolean;
    defaultTeamAssignment?: LiveClassroomTeamAssignmentMode;
    strategyCardPolicy?: LiveClassroomStrategyCardPolicy;
  };
};

export function LiveClassroomStartForm({
  teamId,
  decks,
  defaults,
}: LiveClassroomStartFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("Live Classroom Battle");
  const [sessionType, setSessionType] = useState<LiveClassroomSessionType>(
    defaults?.defaultBattleType ?? "team_battle",
  );
  const [battleMode, setBattleMode] =
    useState<LiveClassroomBattleMode>("individual_team");
  const [deckId, setDeckId] = useState<string>(
    decks[0] ? String(decks[0].id) : "",
  );
  const [questionSourceMode, setQuestionSourceMode] =
    useState<LiveClassroomQuestionSourceMode>("all");
  const [selectedCardIds, setSelectedCardIds] = useState<number[]>([]);
  const [deckCards, setDeckCards] = useState<DeckCardPreview[]>([]);
  const [loadingDeckCards, setLoadingDeckCards] = useState(false);
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [timePerQuestionSec, setTimePerQuestionSec] = useState<number | null>(
    30,
  );
  const [battleStartDelaySec, setBattleStartDelaySec] = useState(
    DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.battleStartDelaySec,
  );
  const [allowAiExplanations, setAllowAiExplanations] = useState(
    defaults?.allowAiExplanations ?? true,
  );
  const [allowStrategyCards, setAllowStrategyCards] = useState(
    defaults?.allowStrategyCards ?? true,
  );
  const [allowMusic, setAllowMusic] = useState(defaults?.allowMusic ?? false);
  const [teamAssignment, setTeamAssignment] =
    useState<LiveClassroomTeamAssignmentMode>(
      defaults?.defaultTeamAssignment ?? "random",
    );
  const [survivalHearts, setSurvivalHearts] = useState(3);
  const [teamCount, setTeamCount] = useState(4);
  const [scheduledFor, setScheduledFor] = useState("");
  const [cardSettings, setCardSettings] = useState<LiveClassroomStrategyCardSettings>(
    () => {
      const out: LiveClassroomStrategyCardSettings = {};
      for (const k of strategyCardsForBattleMode("individual_team")) {
        out[k] = defaultStrategyCardSetting(k);
      }
      return out;
    },
  );
  const [configuringKind, setConfiguringKind] =
    useState<LiveClassroomStrategyCardKind | null>(null);

  useEffect(() => {
    setSelectedCardIds([]);
  }, [deckId]);

  useEffect(() => {
    if (questionSourceMode === "specific" && deckId) setCardPickerOpen(true);
  }, [questionSourceMode, deckId]);

  useEffect(() => {
    if (questionSourceMode !== "specific" || !deckId) return;
    let cancelled = false;
    setLoadingDeckCards(true);
    getCardsForDeckViewerPreviewAction({ deckId: Number(deckId) })
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
  }, [questionSourceMode, deckId]);

  function toggleCardId(id: number, checked: boolean) {
    setSelectedCardIds((prev) =>
      checked ? [...prev, id] : prev.filter((existing) => existing !== id),
    );
  }

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
        return out;
      }
      if (next === "disabled") {
        for (const k of availableStrategyCards) {
          out[k] = { ...(out[k] ?? defaultStrategyCardSetting(k)), scope: "disabled" };
        }
        return out;
      }
      // limited — keep current selection if it's already partial; otherwise turn one off
      const currentlyEnabled = strategyCardEnabledKinds(
        out,
        timeAwareAvailableStrategyCards,
      );
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
      }
      return out;
    });
  }

  function saveCardSetting(
    kind: LiveClassroomStrategyCardKind,
    setting: LiveClassroomStrategyCardSetting,
  ) {
    setCardSettings((prev) => ({ ...prev, [kind]: setting }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (!deckId) {
          toast.error("Select a deck for this session.");
          return;
        }
        if (questionSourceMode === "specific" && selectedCardIds.length === 0) {
          toast.error("Select at least one card for this battle.");
          return;
        }

        const result = await createLiveClassroomSessionAction({
          teamId,
          name,
          sessionType,
          battleMode,
          deckId: Number(deckId),
          questionSourceMode,
          selectedDeckCardIds:
            questionSourceMode === "specific" ? selectedCardIds : undefined,
          timePerQuestionSec,
          battleStartDelaySec,
          allowAiExplanations,
          allowStrategyCards,
          allowMusic,
          teamAssignment,
          survivalHearts:
            battleMode === "survival" ? survivalHearts : undefined,
          strategyCardPolicy: allowStrategyCards
            ? strategyCardPolicy
            : "disabled",
          enabledStrategyCards: allowStrategyCards ? enabledCards : [],
          strategyCardSettings: allowStrategyCards ? cardSettings : undefined,
          scheduledFor: scheduledFor
            ? new Date(scheduledFor).toISOString()
            : null,
          teamCount,
        });

        toast.success(
          scheduledFor
            ? "Session scheduled — see Sessions Pool"
            : `Lobby ready · code ${result.joinCode}`,
        );
        router.push(
          scheduledFor
            ? buildLiveClassroomHref(LIVE_CLASSROOM_ROOT_PATH, teamId)
            : liveClassroomLobbyPath(result.sessionId),
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not create session",
        );
      }
    });
  }

  return (
    <Card className="border-border/80 bg-card/60 shadow-sm">
      <CardHeader>
        <CardTitle>Create Session</CardTitle>
        <CardDescription>
          Configure a Live Classroom™ battle, then open the lobby for students
          to join.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <FieldLabel
                htmlFor="lc-name"
                label="Session name"
                caption={CAPTION_SESSION_NAME}
              />
              <Input
                id="lc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel label="Session type" caption={CAPTION_SESSION_TYPE} />
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
              <FieldLabel label="Battle mode" caption={CAPTION_BATTLE_MODE} />
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
              <FieldLabel label="Start time" caption={CAPTION_START_TIME} />
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
                  {LIVE_CLASSROOM_BATTLE_START_DELAY_OPTIONS_SEC.map((sec) => (
                    <SelectItem key={sec} value={String(sec)}>
                      {battleStartDelayLabel(sec)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel
                label="Team assignment"
                caption={CAPTION_TEAM_ASSIGNMENT}
              />
              <Select
                value={teamAssignment}
                onValueChange={(v) =>
                  setTeamAssignment(v as LiveClassroomTeamAssignmentMode)
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
              <FieldLabel
                htmlFor="lc-time"
                label="Seconds per question"
                caption={CAPTION_SECONDS}
              />
              <Select
                value={timePerQuestionSec == null ? "off" : String(timePerQuestionSec)}
                onValueChange={(v) => {
                  if (v == null) return;
                  setTimePerQuestionSec(v === "off" ? null : Number(v));
                }}
              >
                <SelectTrigger id="lc-time" className="w-full">
                  <SelectValue>
                    {timePerQuestionLabel(timePerQuestionSec)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">No time limit</SelectItem>
                  {LIVE_CLASSROOM_TIME_PER_QUESTION_OPTIONS_SEC.map((sec) => (
                    <SelectItem key={sec} value={String(sec)}>
                      {timePerQuestionLabel(sec)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel
                htmlFor="lc-teams"
                label="Team count"
                caption={CAPTION_TEAM_COUNT}
              />
              <Input
                id="lc-teams"
                type="number"
                min={2}
                max={4}
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
              />
            </div>

            {battleMode === "survival" ? (
              <div className="space-y-2">
                <FieldLabel
                  htmlFor="lc-hearts"
                  label="Survival hearts"
                  caption={CAPTION_SURVIVAL_HEARTS}
                />
                <Input
                  id="lc-hearts"
                  type="number"
                  min={1}
                  max={5}
                  value={survivalHearts}
                  onChange={(e) => setSurvivalHearts(Number(e.target.value))}
                />
              </div>
            ) : null}

            <div className="space-y-2 sm:col-span-2">
              <FieldLabel
                htmlFor="lc-schedule"
                label="Schedule for (optional)"
                caption={CAPTION_SCHEDULE}
              />
              <Input
                id="lc-schedule"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 p-4">
            <FieldLabel
              htmlFor="lc-workspace-deck"
              label="Deck"
              caption={CAPTION_DECK}
            />
            <Select value={deckId} onValueChange={(v) => setDeckId(v ?? "")}>
              <SelectTrigger id="lc-workspace-deck" className="w-full">
                <SelectValue placeholder="Select a deck">
                  {(value) => {
                    if (value == null || value === "") {
                      return (
                        <span className="text-muted-foreground">
                          Select a deck
                        </span>
                      );
                    }
                    const deck = decks.find(
                      (d) => String(d.id) === String(value),
                    );
                    return deck?.name ?? (
                      <span className="text-muted-foreground">
                        Select a deck
                      </span>
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {decks.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {decks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No decks linked to this workspace. Link a deck from Team Admin
                Deck Manager first.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <FieldLabel
                label="Cards to include in this battle"
                caption={CAPTION_QUESTION_SOURCE}
              />
              <Select
                value={questionSourceMode}
                onValueChange={(v) =>
                  setQuestionSourceMode(v as LiveClassroomQuestionSourceMode)
                }
              >
                <SelectTrigger id="lc-question-source" className="w-52">
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
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {selectedCardIds.length > 0
                    ? `${selectedCardIds.length} card${selectedCardIds.length === 1 ? "" : "s"} selected.`
                    : "No cards selected yet."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCardPickerOpen(true)}
                  disabled={!deckId}
                >
                  Choose cards
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                All cards in this deck will be used as questions.
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-sm text-foreground">AI explanations</span>
                <HintBalloon
                  fieldLabel="AI explanations"
                  caption={CAPTION_AI_EXPLANATIONS}
                />
              </div>
              <Switch
                checked={allowAiExplanations}
                onCheckedChange={setAllowAiExplanations}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-sm text-foreground">Strategy cards</span>
                <HintBalloon
                  fieldLabel="Strategy cards"
                  caption={CAPTION_STRATEGY_CARDS}
                />
              </div>
              <Switch
                checked={allowStrategyCards}
                onCheckedChange={setAllowStrategyCards}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-sm text-foreground">Battle music</span>
                <HintBalloon
                  fieldLabel="Battle music"
                  caption={CAPTION_BATTLE_MUSIC}
                />
              </div>
              <Switch checked={allowMusic} onCheckedChange={setAllowMusic} />
            </div>
          </div>

          {allowStrategyCards ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <div className="space-y-2">
                <FieldLabel
                  label="Strategy card policy"
                  caption={CAPTION_STRATEGY_POLICY}
                />
                <Select
                  value={strategyCardPolicy}
                  onValueChange={(v) =>
                    applyStrategyCardPolicy(
                      v as LiveClassroomStrategyCardPolicy,
                    )
                  }
                >
                  <SelectTrigger className="w-full sm:w-56">
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
              <div className="space-y-2">
                <FieldLabel
                  label="Strategy cards available"
                  caption={CAPTION_STRATEGY_KINDS}
                />
                <div className="flex flex-wrap gap-2">
                  {availableStrategyCards.map((kind) => {
                    const setting = cardSettings[kind] ?? defaultStrategyCardSetting(kind);
                    const timerBlocked =
                      kind === "extra_time" && timePerQuestionSec == null;
                    const on = !timerBlocked && setting.scope !== "disabled";
                    return (
                      <Button
                        key={kind}
                        type="button"
                        size="sm"
                        variant={on ? "default" : "outline"}
                        disabled={timerBlocked}
                        title={
                          timerBlocked
                            ? "Enable a question timer to use Extra Time"
                            : undefined
                        }
                        className={timerBlocked ? "opacity-40" : undefined}
                        onClick={() => {
                          if (timerBlocked) return;
                          setConfiguringKind(kind);
                        }}
                      >
                        {strategyCardLabel(kind)}
                        {on && setting.scope === "individual"
                          ? ` · ${setting.cardIds.length} question${setting.cardIds.length === 1 ? "" : "s"}`
                          : ""}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          <Button type="submit" disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {scheduledFor ? "Schedule session" : "Create lobby"}
          </Button>
        </form>
      </CardContent>

      <LiveClassroomStrategyCardConfigDialog
        open={configuringKind != null}
        onOpenChange={(v) => {
          if (!v) setConfiguringKind(null);
        }}
        kind={configuringKind}
        deckId={deckId ? Number(deckId) : null}
        allowedCardIds={
          questionSourceMode === "specific" ? selectedCardIds : null
        }
        setting={
          configuringKind
            ? cardSettings[configuringKind] ?? defaultStrategyCardSetting(configuringKind)
            : defaultStrategyCardSetting("double_points")
        }
        onSave={(setting) => {
          if (configuringKind) saveCardSetting(configuringKind, setting);
        }}
      />

      <Dialog open={cardPickerOpen} onOpenChange={setCardPickerOpen}>
        <DialogContent className="max-h-[min(90vh,44rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose battle cards</DialogTitle>
            <DialogDescription>{CAPTION_QUESTION_PICKER}</DialogDescription>
          </DialogHeader>

          {!deckId ? (
            <p className="text-xs text-muted-foreground">
              Select a deck first to choose specific cards.
            </p>
          ) : loadingDeckCards ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading deck cards…
            </div>
          ) : deckCards.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This deck has no cards yet.
            </p>
          ) : (
            <ScrollArea className="h-64 rounded-lg border border-border/60">
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
                      className="flex items-start gap-2 rounded-md border border-border/50 bg-card/40 p-2 cursor-pointer"
                    >
                      <Checkbox checked={checked} className="mt-0.5" />
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
                                  <Check className="size-3 shrink-0" aria-hidden />
                                ) : (
                                  <X className="size-3 shrink-0" aria-hidden />
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

          {selectedCardIds.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {selectedCardIds.length} card
              {selectedCardIds.length === 1 ? "" : "s"} selected.
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" onClick={() => setCardPickerOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
