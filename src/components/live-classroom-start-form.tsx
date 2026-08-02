"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { liveClassroomLobbyPath } from "@/lib/live-classroom-url";

export type LiveClassroomDeckOption = {
  id: number;
  name: string;
};

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
  const [warmUpSubject, setWarmUpSubject] = useState("");
  const [warmUpTopic, setWarmUpTopic] = useState("");
  const [warmUpGrade, setWarmUpGrade] = useState("");
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
        if (isWarmUp && (!warmUpSubject || !warmUpTopic || !warmUpGrade)) {
          toast.error("Warm-up requires subject, topic, and grade.");
          return;
        }
        if (!isWarmUp && !deckId) {
          toast.error("Select a deck for this session.");
          return;
        }

        const result = await createLiveClassroomSessionAction({
          teamId,
          name,
          sessionType,
          battleMode,
          deckId: isWarmUp ? null : Number(deckId),
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
          warmUp: isWarmUp
            ? {
                subject: warmUpSubject,
                topic: warmUpTopic,
                grade: warmUpGrade,
              }
            : undefined,
          teamCount,
        });

        toast.success(
          scheduledFor
            ? "Session scheduled"
            : `Lobby ready · code ${result.joinCode}`,
        );
        router.push(liveClassroomLobbyPath(result.sessionId));
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
        <CardTitle>Start Session</CardTitle>
        <CardDescription>
          Configure a Live Classroom™ battle, then open the lobby for students
          to join.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="lc-name">Session name</Label>
              <Input
                id="lc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label>Session type</Label>
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
              <Label>Difficulty</Label>
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
              <Label>Team assignment</Label>
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
              <Label htmlFor="lc-qcount">Questions</Label>
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
              <Label htmlFor="lc-time">Seconds per question</Label>
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
              <Label htmlFor="lc-teams">Team count</Label>
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
                <Label htmlFor="lc-hearts">Survival hearts</Label>
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
              <Label htmlFor="lc-schedule">Schedule for (optional)</Label>
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
              <div>
                <p className="text-sm font-medium text-foreground">
                  AI Warm-Up generator
                </p>
                <p className="text-xs text-muted-foreground">
                  Generate questions from subject, topic, and grade instead of a
                  deck.
                </p>
              </div>
              <Switch
                checked={useWarmUp || sessionType === "warm_up"}
                onCheckedChange={(v) => {
                  setUseWarmUp(v);
                  if (v) setSessionType("warm_up");
                }}
              />
            </div>

            {useWarmUp || sessionType === "warm_up" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="lc-subject">Subject</Label>
                  <Input
                    id="lc-subject"
                    value={warmUpSubject}
                    onChange={(e) => setWarmUpSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lc-topic">Topic</Label>
                  <Input
                    id="lc-topic"
                    value={warmUpTopic}
                    onChange={(e) => setWarmUpTopic(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lc-grade">Grade</Label>
                  <Input
                    id="lc-grade"
                    value={warmUpGrade}
                    onChange={(e) => setWarmUpGrade(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Deck</Label>
                <Select value={deckId} onValueChange={(v) => setDeckId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a deck" />
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
                    No decks available. Create a deck first or use Warm-Up.
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <span className="text-sm text-foreground">AI explanations</span>
              <Switch
                checked={allowAiExplanations}
                onCheckedChange={setAllowAiExplanations}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <span className="text-sm text-foreground">Strategy cards</span>
              <Switch
                checked={allowStrategyCards}
                onCheckedChange={setAllowStrategyCards}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <span className="text-sm text-foreground">Battle music</span>
              <Switch checked={allowMusic} onCheckedChange={setAllowMusic} />
            </label>
          </div>

          {allowStrategyCards ? (
            <div className="space-y-3 rounded-lg border border-border/60 p-4">
              <div className="space-y-2">
                <Label>Strategy card policy</Label>
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
