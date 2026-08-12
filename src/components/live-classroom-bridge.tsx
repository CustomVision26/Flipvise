"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";
import Link from "next/link";
import {
  CircleHelp,
  Coins,
  Layers,
  Loader2,
  Presentation,
  Swords,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { setLiveClassroomTeacherGrantAction } from "@/actions/live-classroom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  LiveClassroomBridgeData,
  LiveClassroomBridgeWorkspace,
} from "@/lib/live-classroom-bridge";
import {
  buildLiveClassroomHref,
  LIVE_CLASSROOM_ROOT_PATH,
  liveClassroomHostPath,
  liveClassroomLobbyPath,
} from "@/lib/live-classroom-url";
import { cn } from "@/lib/utils";

const HOST_TOKEN_MIME = "application/x-flipvise-lc-host-token";

const CAPTION_WORKSPACES =
  "Each card is a team-tier workspace with Live Classroom™ unlocked. Double-click or tap Open to enter that workspace’s Sessions Pool.";
const CAPTION_LIVE_BATTLES =
  "Lobby, scheduled, and in-progress battles across the workspaces you can access. Enter opens the lobby or host view.";
const CAPTION_DECKS_OWNER =
  "Decks linked to this workspace. Battles you create here can use these decks as question sources.";
const CAPTION_DECKS_HOST =
  "Decks assigned to you in this workspace. Use these when hosting battles for this group.";
const CAPTION_HOST_TOKENS =
  "Drag a host token onto a team admin to let them host Live Classroom™ battles for this workspace. Drag an assigned token back to the tray to remove it. Without a token, team admins cannot host.";
const CAPTION_TEAM_ADMINS =
  "Drop a host token on a row to activate hosting. Assigned tokens appear as a badge you can drag back to the tray.";

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
        type="button"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`${fieldLabel} help`}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <CircleHelp className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs text-pretty">
        {caption}
      </TooltipContent>
    </Tooltip>
  );
}

type TokenDragPayload = {
  teamId: number;
  /** When set, dragging an assigned token off an admin (to revoke). */
  fromUserId?: string;
};

type LiveClassroomBridgeProps = {
  data: LiveClassroomBridgeData;
};

function battleHref(session: {
  id: number;
  status: string;
}): string {
  if (session.status === "active" || session.status === "paused") {
    return liveClassroomHostPath(session.id);
  }
  return liveClassroomLobbyPath(session.id);
}

export function LiveClassroomBridge({ data }: LiveClassroomBridgeProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function enterWorkspace(teamId: number) {
    router.push(buildLiveClassroomHref(LIVE_CLASSROOM_ROOT_PATH, teamId));
  }

  function assignToken(
    teamId: number,
    memberUserId: string,
    enabled: boolean,
    options?: { revokeFromUserId?: string },
  ) {
    startTransition(async () => {
      try {
        if (options?.revokeFromUserId) {
          await setLiveClassroomTeacherGrantAction({
            teamId,
            memberUserId: options.revokeFromUserId,
            enabled: false,
          });
        }
        await setLiveClassroomTeacherGrantAction({
          teamId,
          memberUserId,
          enabled,
        });
        toast.success(
          enabled
            ? "Host token assigned — this team admin can open Live Classroom™."
            : "Host token removed.",
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update host token",
        );
      }
    });
  }

  function onTokenDragStart(
    e: DragEvent,
    payload: TokenDragPayload,
  ) {
    e.dataTransfer.setData(HOST_TOKEN_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = payload.fromUserId ? "move" : "copy";
  }

  function onAdminDragOver(e: DragEvent, key: string) {
    if (![...e.dataTransfer.types].includes(HOST_TOKEN_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropTarget(key);
  }

  function onTrayDragOver(e: DragEvent) {
    if (![...e.dataTransfer.types].includes(HOST_TOKEN_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget("tray");
  }

  function parsePayload(e: DragEvent): TokenDragPayload | null {
    try {
      const raw = e.dataTransfer.getData(HOST_TOKEN_MIME);
      if (!raw) return null;
      return JSON.parse(raw) as TokenDragPayload;
    } catch {
      return null;
    }
  }

  function onAdminDrop(
    e: DragEvent,
    workspace: LiveClassroomBridgeWorkspace,
    adminUserId: string,
  ) {
    e.preventDefault();
    setDropTarget(null);
    const payload = parsePayload(e);
    if (!payload || payload.teamId !== workspace.teamId) return;
    if (payload.fromUserId === adminUserId) return;
    const admin = workspace.teamAdmins.find((a) => a.userId === adminUserId);
    if (!admin || admin.hasHostToken) {
      toast.message("This team admin already has a host token.");
      return;
    }
    if (payload.fromUserId) {
      assignToken(workspace.teamId, adminUserId, true, {
        revokeFromUserId: payload.fromUserId,
      });
      return;
    }
    if (workspace.availableHostTokens <= 0) {
      toast.message("No host tokens left for this workspace.");
      return;
    }
    assignToken(workspace.teamId, adminUserId, true);
  }

  function onTrayDrop(e: DragEvent, workspace: LiveClassroomBridgeWorkspace) {
    e.preventDefault();
    setDropTarget(null);
    const payload = parsePayload(e);
    if (!payload?.fromUserId || payload.teamId !== workspace.teamId) return;
    assignToken(workspace.teamId, payload.fromUserId, false);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Live Classroom™ workspaces
          </h1>
          <HintBalloon
            fieldLabel="Live Classroom™ workspaces"
            caption={CAPTION_WORKSPACES}
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.isOwnerViewer
            ? "Double-click a workspace to open its Sessions Pool. Drag a host token onto a team admin to let them host battles."
            : "Double-click your assigned workspace to open Live Classroom™. Only workspaces with a host token are listed."}
        </p>
      </div>

      {pending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Updating host tokens…
        </p>
      ) : null}

      {data.liveBattles.length > 0 ? (
        <Card className="border-border/80 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Swords className="size-4" aria-hidden />
              Live battles
              <HintBalloon
                fieldLabel="Live battles"
                caption={CAPTION_LIVE_BATTLES}
              />
            </CardTitle>
            <CardDescription>
              {data.isOwnerViewer
                ? "Enter any live battle from your workspaces."
                : "Battles in your assigned workspaces."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.liveBattles.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {session.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.teamName} · {session.status} · {session.joinCode}
                  </p>
                </div>
                <Button
                  nativeButton={false}
                  size="sm"
                  render={<Link href={battleHref(session)} />}
                >
                  Enter
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data.workspaces.length === 0 ? (
        <Card className="border-border/80 bg-card/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {data.isOwnerViewer
              ? "No Live Classroom™ workspaces yet. Unlock the add-on on an eligible team-tier workspace first."
              : "No host token assigned. Ask the subscription owner to drag a host token onto your team admin account."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.workspaces.map((workspace) => (
            <Card
              key={workspace.teamId}
              className="cursor-pointer border-border/80 bg-card/60 transition-colors hover:border-primary/40"
              onDoubleClick={() => enterWorkspace(workspace.teamId)}
              title="Double-click to open Sessions Pool"
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Presentation className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{workspace.name}</span>
                    </CardTitle>
                    <CardDescription>
                      {workspace.licensedSeats} licensed seats
                      {workspace.isOwner ? " · Owner" : " · Host token"}
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      enterWorkspace(workspace.teamId);
                    }}
                  >
                    Open
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <Layers className="size-3.5" aria-hidden />
                    Decks
                    <HintBalloon
                      fieldLabel="Decks"
                      caption={
                        workspace.isOwner
                          ? CAPTION_DECKS_OWNER
                          : CAPTION_DECKS_HOST
                      }
                    />
                  </p>
                  {workspace.decks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {workspace.isOwner
                        ? "No decks linked to this workspace yet."
                        : "No decks assigned to you in this workspace."}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {workspace.decks.slice(0, 8).map((deck) => (
                        <li
                          key={deck.id}
                          className="truncate text-sm text-foreground"
                        >
                          {deck.name}
                          <span className="text-muted-foreground">
                            {" "}
                            · {deck.cardCount} cards
                          </span>
                        </li>
                      ))}
                      {workspace.decks.length > 8 ? (
                        <li className="text-xs text-muted-foreground">
                          +{workspace.decks.length - 8} more
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>

                {workspace.isOwner ? (
                  <>
                    <Separator className="bg-border/50" />
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Coins className="size-3.5" aria-hidden />
                        Host tokens
                        <HintBalloon
                          fieldLabel="Host tokens"
                          caption={CAPTION_HOST_TOKENS}
                        />
                      </p>
                      <div
                        className={cn(
                          "mb-3 flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 px-2 py-2",
                          dropTarget === "tray" && "border-primary bg-primary/10",
                        )}
                        onDragOver={onTrayDragOver}
                        onDragLeave={() => setDropTarget(null)}
                        onDrop={(e) => onTrayDrop(e, workspace)}
                      >
                        {workspace.availableHostTokens > 0 ? (
                          Array.from({
                            length: workspace.availableHostTokens,
                          }).map((_, i) => (
                            <button
                              key={`token-${workspace.teamId}-${i}`}
                              type="button"
                              draggable
                              onDragStart={(e) =>
                                onTokenDragStart(e, {
                                  teamId: workspace.teamId,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-100"
                              title="Drag onto a team admin"
                            >
                              <Coins className="size-3.5" aria-hidden />
                              Host token
                            </button>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            All host tokens assigned. Drop a token here to
                            reclaim one.
                          </span>
                        )}
                      </div>

                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Users className="size-3.5" aria-hidden />
                        Team admins
                        <HintBalloon
                          fieldLabel="Team admins"
                          caption={CAPTION_TEAM_ADMINS}
                        />
                      </p>
                      {workspace.teamAdmins.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No team admins in this workspace yet.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {workspace.teamAdmins.map((admin) => {
                            const key = `${workspace.teamId}:${admin.userId}`;
                            return (
                              <li
                                key={admin.userId}
                                className={cn(
                                  "flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2",
                                  dropTarget === key &&
                                    "border-primary bg-primary/10",
                                )}
                                onDragOver={(e) => onAdminDragOver(e, key)}
                                onDragLeave={() => setDropTarget(null)}
                                onDrop={(e) =>
                                  onAdminDrop(e, workspace, admin.userId)
                                }
                              >
                                <span className="truncate text-sm text-foreground">
                                  {admin.displayName}
                                </span>
                                {admin.hasHostToken ? (
                                  <span
                                    draggable
                                    onDragStart={(e) =>
                                      onTokenDragStart(e, {
                                        teamId: workspace.teamId,
                                        fromUserId: admin.userId,
                                      })
                                    }
                                    className="cursor-grab active:cursor-grabbing"
                                    title="Drag back to the token tray to remove"
                                  >
                                    <Badge
                                      variant="secondary"
                                      className="gap-1 pointer-events-none"
                                    >
                                      <Coins className="size-3" aria-hidden />
                                      Token assigned
                                    </Badge>
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Drop token here
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                ) : null}

                {workspace.liveSessions.length > 0 ? (
                  <>
                    <Separator className="bg-border/50" />
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Battles here
                      </p>
                      {workspace.liveSessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-sm">
                            {session.name}
                          </span>
                          <Button
                            nativeButton={false}
                            size="sm"
                            variant="outline"
                            onClick={(e) => e.stopPropagation()}
                            render={<Link href={battleHref(session)} />}
                          >
                            Enter
                          </Button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
