"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createLiveClassroomSessionAction } from "@/actions/live-classroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  LIVE_CLASSROOM_BATTLE_MODES,
  LIVE_CLASSROOM_DIFFICULTIES,
  LIVE_CLASSROOM_SESSION_TYPES,
  LIVE_CLASSROOM_STRATEGY_CARD_KINDS,
  LIVE_CLASSROOM_STRATEGY_CARD_POLICIES,
  LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES,
  battleModeLabel,
  sessionTypeLabel,
  strategyCardLabel,
  type LiveClassroomBattleMode,
  type LiveClassroomDifficulty,
  type LiveClassroomSessionType,
  type LiveClassroomStrategyCardKind,
  type LiveClassroomStrategyCardPolicy,
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

const CAPTION_SESSION_NAME =
  "Title shown in the lobby and host controls so students and teachers can recognize this battle.";
const CAPTION_SESSION_TYPE =
  "Choose the battle format — team battle, warm-up, review, and other Live Classroom™ session styles.";
const CAPTION_BATTLE_MODE =
  "How teams compete: individual scoring within teams, captain-led play, or survival with hearts.";
const CAPTION_DIFFICULTY =
  "Sets how hard AI warm-up questions are (and the intended challenge level for this session).";
const CAPTION_TEAM_ASSIGNMENT =
  "How students are placed on teams — random, manual in the lobby, or from saved groups.";
const CAPTION_QUESTIONS =
  "How many questions this session will run (1–30). Warm-up generates this many; deck mode samples from the deck.";
const CAPTION_SECONDS =
  "Countdown timer for each question before the round advances.";
const CAPTION_TEAM_COUNT =
  "Number of competing teams created in the lobby (2–4).";
const CAPTION_SURVIVAL_HEARTS =
  "Lives each team starts with in Survival mode. Wrong answers cost hearts.";
const CAPTION_SCHEDULE =
  "Optional start time. Leave blank to open the lobby immediately; set a time to schedule the session.";
const CAPTION_WARM_UP =
  "When on, AI generates warm-up questions from the selected workspace deck instead of using deck cards directly.";
const CAPTION_DECK =
  "Pick a deck already linked to this workspace. Warm-up uses its name, description, and grade; other modes use its cards.";
const CAPTION_AI_EXPLANATIONS =
  "After answers, show AI explanations for the correct choice and common wrong answers.";
const CAPTION_STRATEGY_CARDS =
  "Give teams power-up cards (extra time, 50/50, shield, and more) during the battle.";
const CAPTION_BATTLE_MUSIC =
  "Play background battle music during the live session when enabled for this workspace.";
const CAPTION_STRATEGY_POLICY =
  "Limited caps how many strategy cards each team gets; unlimited issues the full enabled set; disabled turns them off.";
const CAPTION_STRATEGY_KINDS =
  "Toggle which strategy card types are available this session. Highlighted cards are enabled.";

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
  const [questionCount, setQuestionCount] = useState(5);
  const [timePerQuestionSec, setTimePerQuestionSec] = useState(30);
  const [difficulty, setDifficulty] =
    useState<LiveClassroomDifficulty>("medium");
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
  const [strategyCardPolicy, setStrategyCardPolicy] =
    useState<LiveClassroomStrategyCardPolicy>(
      defaults?.strategyCardPolicy ?? "limited",
    );
  const [survivalHearts, setSurvivalHearts] = useState(3);
  const [teamCount, setTeamCount] = useState(4);
  const [scheduledFor, setScheduledFor] = useState("");
  const [useWarmUp, setUseWarmUp] = useState(sessionType === "warm_up");
  const [enabledCards, setEnabledCards] = useState<
    LiveClassroomStrategyCardKind[]
  >([...LIVE_CLASSROOM_STRATEGY_CARD_KINDS]);

  function toggleCard(kind: LiveClassroomStrategyCardKind) {
    setEnabledCards((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const isWarmUp = sessionType === "warm_up" || useWarmUp;
        if (!deckId) {
          toast.error(
            isWarmUp
              ? "Link a deck to this workspace for warm-up."
              : "Select a deck for this session.",
          );
          return;
        }

        const result = await createLiveClassroomSessionAction({
          teamId,
          name,
          sessionType: isWarmUp ? "warm_up" : sessionType,
          battleMode,
          deckId: Number(deckId),
          questionCount,
          timePerQuestionSec,
          difficulty,
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
          scheduledFor: scheduledFor
            ? new Date(scheduledFor).toISOString()
            : null,
          warmUp: isWarmUp ? true : undefined,
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
                onValueChange={(v) => {
                  const next = v as LiveClassroomSessionType;
                  setSessionType(next);
                  setUseWarmUp(next === "warm_up");
                }}
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
              <FieldLabel label="Difficulty" caption={CAPTION_DIFFICULTY} />
              <Select
                value={difficulty}
                onValueChange={(v) =>
                  setDifficulty(v as LiveClassroomDifficulty)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIVE_CLASSROOM_DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
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
                htmlFor="lc-qcount"
                label="Questions"
                caption={CAPTION_QUESTIONS}
              />
              <Input
                id="lc-qcount"
                type="number"
                min={1}
                max={30}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel
                htmlFor="lc-time"
                label="Seconds per question"
                caption={CAPTION_SECONDS}
              />
              <Input
                id="lc-time"
                type="number"
                min={5}
                max={180}
                value={timePerQuestionSec}
                onChange={(e) => setTimePerQuestionSec(Number(e.target.value))}
              />
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

          <div className="space-y-3 rounded-lg border border-border/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium text-foreground">
                    AI Warm-Up generator
                  </p>
                  <HintBalloon
                    fieldLabel="AI Warm-Up generator"
                    caption={CAPTION_WARM_UP}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Generate warm-up questions from a deck linked to this
                  workspace.
                </p>
              </div>
              <Switch
                checked={useWarmUp || sessionType === "warm_up"}
                onCheckedChange={(v) => {
                  setUseWarmUp(v);
                  if (v) {
                    setSessionType("warm_up");
                  } else if (sessionType === "warm_up") {
                    setSessionType(
                      defaults?.defaultBattleType &&
                        defaults.defaultBattleType !== "warm_up"
                        ? defaults.defaultBattleType
                        : "team_battle",
                    );
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <FieldLabel
                htmlFor="lc-workspace-deck"
                label={
                  useWarmUp || sessionType === "warm_up"
                    ? "Link deck to this workspace"
                    : "Deck"
                }
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
            </div>
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
                    setStrategyCardPolicy(v as LiveClassroomStrategyCardPolicy)
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
                  {LIVE_CLASSROOM_STRATEGY_CARD_KINDS.map((kind) => {
                    const on = enabledCards.includes(kind);
                    return (
                      <Button
                        key={kind}
                        type="button"
                        size="sm"
                        variant={on ? "default" : "outline"}
                        onClick={() => toggleCard(kind)}
                      >
                        {strategyCardLabel(kind)}
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
    </Card>
  );
}
