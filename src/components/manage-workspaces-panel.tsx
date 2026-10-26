"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, Pencil, Trash2 } from "lucide-react";
import {
  deleteTeamWorkspaceAction,
  updateTeamWorkspaceNameAction,
} from "@/actions/teams";
import { AddTeamDialog } from "@/components/add-team-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { displayNameForBillingPlanSlug } from "@/lib/plan-slug-display";
import type { WorkspaceCreatePlanId } from "@/lib/education-plans";

function formatEventTime(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function planLabel(slug: string) {
  return displayNameForBillingPlanSlug(slug);
}

function historyAction(action: string): { label: string; className: string } {
  if (action === "created") {
    return { label: "Created", className: "manage-workspaces-created" };
  }
  if (action === "deleted") {
    return { label: "Deleted", className: "manage-workspaces-deleted" };
  }
  if (action === "updated") {
    return { label: "Renamed", className: "manage-workspaces-renamed" };
  }
  return { label: action, className: "manage-workspaces-renamed" };
}

export type ManageWorkspacesTeamRow = {
  id: number;
  name: string;
  planSlug: string;
};

interface ManageWorkspacesPanelProps {
  teams: ManageWorkspacesTeamRow[];
  events: TeamWorkspaceEventRow[];
  addTeamPlanSlug: WorkspaceCreatePlanId;
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
    <div className="flex flex-col gap-6">
      <Card className="manage-workspaces-card shadow-none ring-0">
        <div className="manage-workspaces-section-header">
          <div>
            <h2>Your workspaces</h2>
            <p>
              Rename or remove subscriber-owned team workspaces. Members lose access when a
              workspace is deleted.
            </p>
          </div>
          <AddTeamDialog
            planSlug={addTeamPlanSlug}
            isAtLimit={isAtTeamLimit}
            existingWorkspaceNames={teams.map((t) => t.name)}
          />
        </div>

        {teams.length === 0 ? (
          <p className="manage-workspaces-empty">No workspaces yet. Create one above.</p>
        ) : (
          <div className="manage-workspaces-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="w-[8rem] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge className="manage-workspaces-plan">
                        <Crown aria-hidden />
                        {planLabel(t.planSlug)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="icon"
                          className="manage-workspaces-edit"
                          onClick={() => openEdit(t)}
                          aria-label={`Rename workspace ${t.name}`}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="default"
                          size="icon"
                          className="manage-workspaces-delete"
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
      </Card>

      <Card className="manage-workspaces-card shadow-none ring-0">
        <div className="manage-workspaces-section-header">
          <div>
            <h2>Workspace history</h2>
            <p>Record of workspaces created, renamed, and deleted on your subscription.</p>
          </div>
        </div>

        {events.length === 0 ? (
          <p className="manage-workspaces-empty">No events yet — changes will appear here.</p>
        ) : (
          <div className="manage-workspaces-table">
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
                {events.map((ev) => {
                  const action = historyAction(ev.action);
                  return (
                    <TableRow key={ev.id}>
                      <TableCell className="whitespace-nowrap">{formatEventTime(ev.createdAt)}</TableCell>
                      <TableCell>
                        <Badge className={action.className}>{action.label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{ev.teamName}</TableCell>
                      <TableCell className="max-w-md">{eventSummary(ev)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

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
