"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2 } from "lucide-react";
import type { TeamInvitationRow } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { revokeTeamInvitationAction } from "@/actions/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { teamAdminTableWrapClass } from "@/components/team-admin-panel-styles";

type InvitationRow = TeamInvitationRow;

function formatInviteTimestamp(d: Date) {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function daysUntilExpiry(expiresAt: Date): number {
  return Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function inviterPrimaryLine(
  invitedByUserId: string | null,
  ownerUserId: string,
  displays: Record<string, ClerkUserFieldDisplay>,
) {
  const id = invitedByUserId ?? ownerUserId;
  return displays[id]?.primaryLine ?? id;
}

function historyStatusLabel(inv: InvitationRow) {
  if (inv.status === "pending" && inv.expiresAt.getTime() <= Date.now()) {
    return "Expired";
  }
  switch (inv.status) {
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Declined";
    case "expired":
      return "Expired";
    case "revoked":
      return "Revoked";
    case "pending":
      return "Pending";
    default:
      return inv.status;
  }
}

function roleLabel(role: "team_admin" | "team_member") {
  return role === "team_admin" ? "Team admin" : "Member";
}

function teamInviteAcceptUrl(token: string) {
  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "";
  return `${origin}/invite/team/${token}`;
}

export function TeamActiveInvitationsTable({
  teamId,
  ownerUserId,
  workspaceName,
  invitations,
  userFieldDisplayById,
}: {
  teamId: number;
  ownerUserId: string;
  /** Workspace shown in the dashboard team selector; all rows are for this workspace. */
  workspaceName: string;
  invitations: InvitationRow[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [revokeDialogId, setRevokeDialogId] = React.useState<number | null>(null);
  const [revokeSaving, setRevokeSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const revokeTargetIdRef = React.useRef<number | null>(null);
  const [viewInviteId, setViewInviteId] = React.useState<number | null>(null);
  const [copiedInviteId, setCopiedInviteId] = React.useState<number | null>(null);
  const copyResetTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
    };
  }, []);

  async function confirmRevoke() {
    const invitationId = revokeTargetIdRef.current;
    if (invitationId == null) return;
    setError(null);
    setRevokeSaving(true);
    setBusyId(invitationId);
    try {
      await revokeTeamInvitationAction({ teamId, invitationId });
      revokeTargetIdRef.current = null;
      setRevokeDialogId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke invitation.");
    } finally {
      setRevokeSaving(false);
      setBusyId(null);
    }
  }

  async function copyInviteUrl(invitationId: number, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(invitationId);
      if (copyResetTimerRef.current) clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = setTimeout(() => setCopiedInviteId(null), 2000);
    } catch {
      setError("Could not copy the invitation URL.");
    }
  }

  const revokeTargetEmail =
    revokeDialogId != null
      ? (invitations.find((i) => i.id === revokeDialogId)?.email ?? null)
      : null;

  const viewTarget =
    viewInviteId != null
      ? (invitations.find((i) => i.id === viewInviteId) ?? null)
      : null;
  const viewInviteUrl = viewTarget ? teamInviteAcceptUrl(viewTarget.token) : "";

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className={teamAdminTableWrapClass}>
      <Table className="min-w-[44rem] text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Workspace</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead className="whitespace-nowrap">Expires in</TableHead>
            <TableHead>Invited by</TableHead>
            <TableHead className="text-end">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="max-w-[12rem] break-all text-sm">
                {inv.email}
              </TableCell>
              <TableCell className="max-w-[10rem] truncate" title={workspaceName}>
                {workspaceName}
              </TableCell>
              <TableCell>{roleLabel(inv.role)}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                {formatInviteTimestamp(inv.createdAt)}
              </TableCell>
              <TableCell className="tabular-nums">{daysUntilExpiry(inv.expiresAt)}</TableCell>
              <TableCell className="max-w-[min(100%,200px)] truncate text-sm">
                <span title={inviterPrimaryLine(inv.invitedByUserId, ownerUserId, userFieldDisplayById)}>
                  {inviterPrimaryLine(inv.invitedByUserId, ownerUserId, userFieldDisplayById)}
                </span>
              </TableCell>
              <TableCell className="text-end">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === inv.id}
                    onClick={() => {
                      setError(null);
                      setViewInviteId(inv.id);
                    }}
                  >
                    <Link2 className="size-3.5" aria-hidden />
                    View URL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyId === inv.id}
                    onClick={() => {
                      setError(null);
                      revokeTargetIdRef.current = inv.id;
                      setRevokeDialogId(inv.id);
                    }}
                  >
                    Revoke
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <Dialog
        open={viewInviteId != null}
        onOpenChange={(open) => {
          if (!open) {
            setViewInviteId(null);
            setCopiedInviteId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invitation URL</DialogTitle>
            <DialogDescription>
              {viewTarget
                ? `Share this link with ${viewTarget.email} so they can accept the invite.`
                : "Share this link with the invitee so they can accept."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={viewInviteUrl}
              aria-label="Invitation URL"
              className="min-w-0 flex-1 font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              disabled={!viewInviteUrl || viewTarget == null}
              aria-label={
                viewTarget != null && copiedInviteId === viewTarget.id
                  ? "Copied"
                  : "Copy invitation URL"
              }
              onClick={() => {
                if (viewTarget == null || !viewInviteUrl) return;
                void copyInviteUrl(viewTarget.id, viewInviteUrl);
              }}
            >
              {viewTarget != null && copiedInviteId === viewTarget.id ? (
                <Check className="size-4 text-emerald-400" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokeDialogId != null}
        onOpenChange={(open) => {
          if (!open) {
            revokeTargetIdRef.current = null;
            setRevokeDialogId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTargetEmail
                ? `The pending invite to ${revokeTargetEmail} will be withdrawn. They will not be able to accept it.`
                : "This pending invite will be withdrawn."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokeSaving}
              onClick={() => void confirmRevoke()}
            >
              {revokeSaving ? "Revoking…" : "Revoke invitation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TeamInvitationHistoryTable({
  ownerUserId,
  workspaceName,
  rows,
  userFieldDisplayById,
}: {
  ownerUserId: string;
  /** Display name of the workspace each invitation targeted (history is loaded per workspace). */
  workspaceName: string;
  rows: InvitationRow[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No invitation history yet.</p>;
  }

  return (
    <div className={teamAdminTableWrapClass}>
    <Table className="min-w-[44rem] text-sm">
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Workspace</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Sent</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Invited by</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((inv) => (
          <TableRow key={inv.id}>
            <TableCell className="max-w-[12rem] break-all text-sm">
              {inv.email}
            </TableCell>
            <TableCell className="max-w-[10rem] truncate" title={workspaceName}>
              {workspaceName}
            </TableCell>
            <TableCell>{roleLabel(inv.role)}</TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
              {formatInviteTimestamp(inv.createdAt)}
            </TableCell>
            <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
              {formatInviteTimestamp(inv.expiresAt)}
            </TableCell>
            <TableCell>{historyStatusLabel(inv)}</TableCell>
            <TableCell className="max-w-[min(100%,200px)] truncate text-sm">
              <span title={inviterPrimaryLine(inv.invitedByUserId, ownerUserId, userFieldDisplayById)}>
                {inviterPrimaryLine(inv.invitedByUserId, ownerUserId, userFieldDisplayById)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
