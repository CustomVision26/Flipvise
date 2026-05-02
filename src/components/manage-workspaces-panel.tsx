"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteTeamWorkspaceAction,
  updateTeamWorkspaceNameAction,
} from "@/actions/teams";
import { AddTeamDialogLazy } from "@/components/add-team-dialog-lazy";
import { Button } from "@/components/ui/button";
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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamWorkspaceEventRow } from "@/db/queries/team-workspace-events";
import { isTeamPlanId, TEAM_PLAN_LABELS, type TeamPlanId } from "@/lib/team-plans";

function formatEventTime(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function planLabel(slug: string) {
  return isTeamPlanId(slug) ? TEAM_PLAN_LABELS[slug as TeamPlanId] : slug;
}

export type ManageWorkspacesTeamRow = {
  id: number;
  name: string;
  planSlug: string;
};

interface ManageWorkspacesPanelProps {
  teams: ManageWorkspacesTeamRow[];
  events: TeamWorkspaceEventRow[];
  addTeamPlanSlug: TeamPlanId;
  isAtTeamLimit: boolean;
}

export function ManageWorkspacesPanel({
  teams,
  events,
  addTeamPlanSlug,
  isAtTeamLimit,
}: ManageWorkspacesPanelProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingTeam, setEditingTeam] = React.useState<ManageWorkspacesTeamRow | null>(
    null,
  );
  const [editName, setEditName] = React.useState("");
  const [editPending, setEditPending] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletingTeam, setDeletingTeam] = React.useState<ManageWorkspacesTeamRow | null>(
    null,
  );
  const [deletePending, setDeletePending] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  function openEdit(team: ManageWorkspacesTeamRow) {
    setEditingTeam(team);
    setEditName(team.name);
    setEditError(null);
    setEditOpen(true);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeam) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Name is required.");
      return;
    }
    setEditPending(true);
    setEditError(null);
    try {
      await updateTeamWorkspaceNameAction({
        teamId: editingTeam.id,
        name: trimmed,
      });
      setEditOpen(false);
      setEditingTeam(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not rename workspace.");
    } finally {
      setEditPending(false);
    }
  }

  async function confirmDelete() {
    if (!deletingTeam) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteTeamWorkspaceAction({ teamId: deletingTeam.id });
      setDeleteOpen(false);
      setDeletingTeam(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete workspace.");
    } finally {
      setDeletePending(false);
    }
  }

  function eventSummary(ev: TeamWorkspaceEventRow): string {
    switch (ev.action) {
      case "created":
        return `Workspace created`;
      case "deleted":
        return `Workspace deleted`;
      case "updated":
        return ev.previousTeamName
          ? `Renamed from “${ev.previousTeamName}” to “${ev.teamName}”`
          : `Renamed to “${ev.teamName}”`;
      default:
        return ev.action;
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your workspaces</h2>
            <p className="text-sm text-muted-foreground">
              Rename or remove subscriber-owned team workspaces. Members lose access when a workspace
              is deleted.
            </p>
          </div>
          <AddTeamDialogLazy
            planSlug={addTeamPlanSlug}
            isAtLimit={isAtTeamLimit}
          />
        </div>

        {teams.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No workspaces yet. Create one above.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right w-[8rem]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">{planLabel(t.planSlug)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => openEdit(t)}
                          aria-label={`Rename workspace ${t.name}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeletingTeam(t);
                            setDeleteError(null);
                            setDeleteOpen(true);
                          }}
                          aria-label={`Delete workspace ${t.name}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Workspace history</h2>
          <p className="text-sm text-muted-foreground">
            Record of workspaces created, renamed, and deleted on your subscription.
          </p>
        </div>

        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No events yet — changes will appear here.
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatEventTime(ev.createdAt)}
                    </TableCell>
                    <TableCell className="capitalize">{ev.action}</TableCell>
                    <TableCell className="font-medium">{ev.teamName}</TableCell>
                    <TableCell className="text-muted-foreground max-w-md">
                      {eventSummary(ev)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          if (!editPending) {
            setEditOpen(next);
            if (!next) setEditingTeam(null);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>Rename workspace</DialogTitle>
            <DialogDescription>Update the display name for this team workspace.</DialogDescription>
          </DialogHeader>
          <form id="edit-workspace-form" onSubmit={submitEdit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-workspace-name">Workspace name</Label>
              <Input
                id="edit-workspace-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={editPending}
                maxLength={255}
                autoFocus
              />
            </div>
            {editError && (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            )}
          </form>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />} disabled={editPending}>
              Cancel
            </DialogClose>
            <Button type="submit" form="edit-workspace-form" disabled={editPending}>
              {editPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(next) => {
          if (!deletePending) {
            setDeleteOpen(next);
            if (!next) setDeletingTeam(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTeam ? (
                <>
                  <span className="block">
                    “{deletingTeam.name}” will be removed. Team members and pending invitations lose
                    access. Team decks become unassigned from this workspace and all cards are
                    deleted.
                  </span>
                  {deleteError ? (
                    <span className="mt-2 block text-destructive">{deleteError}</span>
                  ) : null}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Delete workspace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
