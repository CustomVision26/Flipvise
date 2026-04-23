"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { InferSelectModel } from "drizzle-orm";
import { teamInvitations } from "@/db/schema";
import type { ClerkUserFieldDisplay } from "@/lib/clerk-user-display";
import { revokeTeamInvitationAction } from "@/actions/teams";
import { Button } from "@/components/ui/button";
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

type InvitationRow = InferSelectModel<typeof teamInvitations>;

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

export function TeamActiveInvitationsTable({
  teamId,
  ownerUserId,
  invitations,
  userFieldDisplayById,
}: {
  teamId: number;
  ownerUserId: string;
  invitations: InvitationRow[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
}) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [revokeDialogId, setRevokeDialogId] = React.useState<number | null>(null);
  const [revokeSaving, setRevokeSaving] = React.useState(false);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const revokeTargetIdRef = React.useRef<number | null>(null);

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

  const revokeTargetEmail =
    revokeDialogId != null
      ? (invitations.find((i) => i.id === revokeDialogId)?.email ?? null)
      : null;

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead className="whitespace-nowrap">Days until expiry</TableHead>
            <TableHead>Invited by</TableHead>
            <TableHead className="text-end">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((inv) => (
            <TableRow key={inv.id}>
              <TableCell className="max-w-[min(100%,220px)] font-mono text-xs break-all">
                {inv.email}
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
  rows,
  userFieldDisplayById,
}: {
  ownerUserId: string;
  rows: InvitationRow[];
  userFieldDisplayById: Record<string, ClerkUserFieldDisplay>;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No invitation history yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
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
            <TableCell className="max-w-[min(100%,220px)] font-mono text-xs break-all">
              {inv.email}
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
  );
}
