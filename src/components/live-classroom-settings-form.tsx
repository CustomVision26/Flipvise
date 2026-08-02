"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  setLiveClassroomTeacherGrantAction,
  updateLiveClassroomSettingsAction,
} from "@/actions/live-classroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  LIVE_CLASSROOM_SESSION_TYPES,
  LIVE_CLASSROOM_STRATEGY_CARD_POLICIES,
  LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES,
  sessionTypeLabel,
  type LiveClassroomSessionType,
  type LiveClassroomStrategyCardPolicy,
  type LiveClassroomTeamAssignmentMode,
} from "@/lib/live-classroom-types";

export type LiveClassroomTeacherMember = {
  userId: string;
  displayName: string;
  hasTeacherGrant: boolean;
};

type LiveClassroomSettingsFormProps = {
  teamId: number;
  licensedSeats: number;
  canRaiseConcurrent: boolean;
  initial: {
    enabled: boolean;
    defaultBattleType: LiveClassroomSessionType;
    allowMusic: boolean;
    allowStrategyCards: boolean;
    allowAiExplanations: boolean;
    defaultTeamAssignment: LiveClassroomTeamAssignmentMode;
    maxConcurrentSessions: number;
    strategyCardPolicy: LiveClassroomStrategyCardPolicy;
    strategyCardLimitPerTeam: number;
  };
  members: LiveClassroomTeacherMember[];
};

export function LiveClassroomSettingsForm({
  teamId,
  licensedSeats,
  canRaiseConcurrent,
  initial,
  members,
}: LiveClassroomSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [grantPending, setGrantPending] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(initial.enabled);
  const [defaultBattleType, setDefaultBattleType] =
    useState<LiveClassroomSessionType>(initial.defaultBattleType);
  const [allowMusic, setAllowMusic] = useState(initial.allowMusic);
  const [allowStrategyCards, setAllowStrategyCards] = useState(
    initial.allowStrategyCards,
  );
  const [allowAiExplanations, setAllowAiExplanations] = useState(
    initial.allowAiExplanations,
  );
  const [defaultTeamAssignment, setDefaultTeamAssignment] =
    useState<LiveClassroomTeamAssignmentMode>(initial.defaultTeamAssignment);
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(
    initial.maxConcurrentSessions,
  );
  const [strategyCardPolicy, setStrategyCardPolicy] =
    useState<LiveClassroomStrategyCardPolicy>(initial.strategyCardPolicy);
  const [strategyCardLimitPerTeam, setStrategyCardLimitPerTeam] = useState(
    initial.strategyCardLimitPerTeam,
  );

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateLiveClassroomSettingsAction({
          teamId,
          enabled,
          defaultBattleType,
          allowMusic,
          allowStrategyCards,
          allowAiExplanations,
          defaultTeamAssignment,
          maxConcurrentSessions,
          strategyCardPolicy,
          strategyCardLimitPerTeam,
        });
        toast.success("Settings saved");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not save settings",
        );
      }
    });
  }

  async function toggleTeacher(member: LiveClassroomTeacherMember, next: boolean) {
    setGrantPending(member.userId);
    try {
      await setLiveClassroomTeacherGrantAction({
        teamId,
        memberUserId: member.userId,
        enabled: next,
      });
      toast.success(
        next
          ? `${member.displayName} can host sessions`
          : `Host access removed for ${member.displayName}`,
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update teacher grant",
      );
    } finally {
      setGrantPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle>Organization settings</CardTitle>
          <CardDescription>
            Defaults for Live Classroom™ sessions. Licensed seats:{" "}
            <Badge variant="outline">{licensedSeats}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="space-y-5">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Enabled</p>
                <p className="text-xs text-muted-foreground">
                  When off, hosts cannot start new sessions.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default session type</Label>
                <Select
                  value={defaultBattleType}
                  onValueChange={(v) =>
                    setDefaultBattleType(v as LiveClassroomSessionType)
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
                <Label>Default team assignment</Label>
                <Select
                  value={defaultTeamAssignment}
                  onValueChange={(v) =>
                    setDefaultTeamAssignment(
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
                <Label>Strategy card policy</Label>
                <Select
                  value={strategyCardPolicy}
                  onValueChange={(v) =>
                    setStrategyCardPolicy(v as LiveClassroomStrategyCardPolicy)
                  }
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

              <div className="space-y-2">
                <Label htmlFor="lc-card-limit">Cards per team</Label>
                <Input
                  id="lc-card-limit"
                  type="number"
                  min={0}
                  max={20}
                  value={strategyCardLimitPerTeam}
                  onChange={(e) =>
                    setStrategyCardLimitPerTeam(Number(e.target.value))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lc-concurrent">Max concurrent sessions</Label>
                <Input
                  id="lc-concurrent"
                  type="number"
                  min={1}
                  max={canRaiseConcurrent ? 20 : 1}
                  value={maxConcurrentSessions}
                  disabled={!canRaiseConcurrent && maxConcurrentSessions <= 1}
                  onChange={(e) =>
                    setMaxConcurrentSessions(Number(e.target.value))
                  }
                />
                {!canRaiseConcurrent ? (
                  <p className="text-xs text-muted-foreground">
                    Enterprise plans can raise this above 1.
                  </p>
                ) : null}
              </div>
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

            <Button type="submit" disabled={pending} className="gap-2">
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save settings
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/60 shadow-sm">
        <CardHeader>
          <CardTitle>Teacher host grants</CardTitle>
          <CardDescription>
            Grant team members permission to host Live Classroom™ sessions.
            Owners and team admins can host by default.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members available to grant.
            </p>
          ) : (
            members.map((member) => {
              const pendingGrant = grantPending === member.userId;
              return (
                <div key={member.userId}>
                  <label className="flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2">
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">
                      {member.displayName}
                    </span>
                    <span className="flex items-center gap-2">
                      {pendingGrant ? (
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                      ) : null}
                      <Switch
                        checked={member.hasTeacherGrant}
                        disabled={pendingGrant}
                        onCheckedChange={(v) => void toggleTeacher(member, v)}
                      />
                    </span>
                  </label>
                  <Separator className="my-2 bg-border/40 last:hidden" />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
