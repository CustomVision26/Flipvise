"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  acceptTeamInvitationByIdAction,
  rejectTeamInvitationByIdAction,
} from "@/actions/teams";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TeamInviteInboxOutcome } from "@/lib/team-invite-inbox-outcome";

export type { TeamInviteInboxOutcome };
export type TeamInviteInboxItemView = {
  invitationId: number;
  teamName: string;
  role: "team_admin" | "team_member";
  inviterDisplayName: string;
  expiresAtIso: string;
  createdAtIso: string;
  outcome: TeamInviteInboxOutcome;
};

function roleLabel(role: "team_admin" | "team_member") {
  return role === "team_admin" ? "Team admin" : "Member";
}

function outcomeBadge(outcome: TeamInviteInboxOutcome) {
  switch (outcome) {
    case "needs_response":
      return (
        <Badge variant="secondary" className="shrink-0">
          Pending
        </Badge>
      );
    case "pending_expired":
      return (
        <Badge variant="outline" className="shrink-0">
          Expired
        </Badge>
      );
    case "accepted":
      return (
        <Badge className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-600/90">
          Accepted
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="destructive" className="shrink-0">
          Declined
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="outline" className="shrink-0">
          Expired
        </Badge>
      );
    case "revoked":
      return (
        <Badge variant="outline" className="shrink-0">
          Withdrawn
        </Badge>
      );
    default:
      return null;
  }
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function TeamInviteInboxClient({
  items,
  heading = "Team invitations",
  description = "Invites sent to your account email. Accept or decline here, or use the invite link from your email.",
}: {
  items: TeamInviteInboxItemView[];
  heading?: string;
  description?: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const openItems = items.filter(
    (i) => i.outcome === "needs_response" || i.outcome === "pending_expired",
  );
  const historyItems = items.filter(
    (i) =>
      i.outcome === "accepted" ||
      i.outcome === "rejected" ||
      i.outcome === "expired" ||
      i.outcome === "revoked",
  );

  async function onAccept(invitationId: number) {
    setError(null);
    setPendingId(invitationId);
    try {
      await acceptTeamInvitationByIdAction({ invitationId });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept invitation.");
    } finally {
      setPendingId(null);
    }
  }

  async function onReject(invitationId: number) {
    setError(null);
    setPendingId(invitationId);
    try {
      await rejectTeamInvitationByIdAction({ invitationId });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not decline invitation.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{heading}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Tabs defaultValue="open" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="open">
              Open
              {openItems.length > 0 ? (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({openItems.length})
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="history">
              History
              {historyItems.length > 0 ? (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({historyItems.length})
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4 space-y-3">
            {openItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open invitations.
              </p>
            ) : (
              openItems.map((row) => (
                <div
                  key={row.invitationId}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{row.teamName}</p>
                      {outcomeBadge(row.outcome)}
                      <Badge variant="outline" className="shrink-0">
                        {roleLabel(row.role)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      From <span className="text-foreground">{row.inviterDisplayName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Sent {formatShortDate(row.createdAtIso)}
                      {" · "}
                      Expires {formatShortDate(row.expiresAtIso)}
                    </p>
                  </div>
                  {row.outcome === "needs_response" ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pendingId === row.invitationId}
                        onClick={() => onAccept(row.invitationId)}
                      >
                        {pendingId === row.invitationId ? "Working…" : "Accept"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pendingId === row.invitationId}
                        onClick={() => onReject(row.invitationId)}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground sm:max-w-[12rem] sm:text-right">
                      This invite has expired. Ask a team admin to send a new one if you still want to join.
                    </p>
                  )}
                </div>
              ))
            )}
          </TabsContent>
          <TabsContent value="history" className="mt-4 space-y-3">
            {historyItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No past invitations.</p>
            ) : (
              historyItems.map((row) => (
                <div
                  key={row.invitationId}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{row.teamName}</p>
                      {outcomeBadge(row.outcome)}
                      <Badge variant="outline" className="shrink-0">
                        {roleLabel(row.role)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(row.createdAtIso)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
