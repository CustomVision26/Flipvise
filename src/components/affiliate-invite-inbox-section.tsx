"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, CheckCircle2, Clock } from "lucide-react";
import { acceptAffiliateInviteAction } from "@/actions/affiliates";
import { useRouter } from "next/navigation";
import type { SerializedAffiliate } from "@/lib/admin-dashboard-types";

interface Props {
  affiliates: SerializedAffiliate[];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function planLabel(slug: string): string {
  if (slug === "pro") return "Pro";
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status: "pending" | "active" | "revoked") {
  switch (status) {
    case "pending":
      return (
        <Badge variant="secondary" className="text-xs">
          Pending
        </Badge>
      );
    case "active":
      return (
        <Badge className="text-xs bg-emerald-600 text-white hover:bg-emerald-600/90">
          Active
        </Badge>
      );
    case "revoked":
      return (
        <Badge variant="destructive" className="text-xs">
          Revoked
        </Badge>
      );
  }
}

function PendingAffiliateCard({ invite }: { invite: SerializedAffiliate }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAccept() {
    if (!invite.token) return;
    setError(null);
    startTransition(async () => {
      try {
        await acceptAffiliateInviteAction({ token: invite.token! });
        setAccepted(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to accept invite");
      }
    });
  }

  if (accepted) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <div>
          <p className="font-medium text-sm text-foreground">Invite accepted!</p>
          <p className="text-xs text-muted-foreground">
            Your {planLabel(invite.planAssigned)} plan is now active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{invite.affiliateName}</p>
          <Badge variant="secondary" className="text-xs">
            {planLabel(invite.planAssigned)} plan
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been invited to join as a marketing affiliate by{" "}
          <span className="text-foreground font-medium">{invite.addedByName}</span>.
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Valid until {formatDate(invite.endsAt)}
        </p>
        {error && (
          <p className="text-xs text-destructive rounded bg-destructive/10 px-2 py-1">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          onClick={handleAccept}
          disabled={isPending || !invite.token}
        >
          {isPending ? "Accepting…" : "Accept Invite"}
        </Button>
      </div>
    </div>
  );
}

function HistoryAffiliateRow({ invite }: { invite: SerializedAffiliate }) {
  const isExpired =
    invite.status === "active" && new Date(invite.endsAt) < new Date();

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-foreground">{invite.affiliateName}</p>
          {statusBadge(invite.status)}
          {isExpired && (
            <Badge variant="outline" className="text-xs text-destructive border-destructive/50">
              Expired
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {planLabel(invite.planAssigned)} plan
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Added by <span className="text-foreground">{invite.addedByName}</span>
          {invite.inviteAcceptedAt && (
            <> · Accepted {formatDate(invite.inviteAcceptedAt)}</>
          )}
          {invite.revokedAt && (
            <> · Revoked {formatDate(invite.revokedAt)}</>
          )}
        </p>
        {invite.status === "active" && !isExpired && (
          <p className="text-xs text-muted-foreground">
            Active until {formatDate(invite.endsAt)}
          </p>
        )}
      </div>
    </div>
  );
}

export function AffiliateInviteInboxSection({ affiliates }: Props) {
  const openItems = affiliates.filter((a) => a.status === "pending");
  const historyItems = affiliates.filter(
    (a) => a.status === "active" || a.status === "revoked",
  );

  if (affiliates.length === 0) return null;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Affiliate Invitations
          {openItems.length > 0 && (
            <Badge className="ml-1 text-xs" variant="default">
              {openItems.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Marketing affiliate invitations sent to your account. Accept pending
          invitations or review past affiliate arrangements.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue={openItems.length > 0 ? "open" : "history"} className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="open">
              Open
              {openItems.length > 0 && (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({openItems.length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">
              History
              {historyItems.length > 0 && (
                <span className="ml-1 tabular-nums text-muted-foreground">
                  ({historyItems.length})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open" className="mt-4 space-y-3">
            {openItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open affiliate invitations.
              </p>
            ) : (
              openItems.map((invite) => (
                <PendingAffiliateCard key={invite.id} invite={invite} />
              ))
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-3">
            {historyItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No past affiliate arrangements.
              </p>
            ) : (
              historyItems.map((invite) => (
                <HistoryAffiliateRow key={invite.id} invite={invite} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
