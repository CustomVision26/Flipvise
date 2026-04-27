"use client";

import { useState, useTransition } from "react";
import { createTeamWorkspaceForUserAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateUserWorkspaceButtonProps = {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string | null;
  isSelf: boolean;
  disabled?: boolean;
};

export function CreateUserWorkspaceButton({
  targetUserId,
  targetUserName,
  targetUserEmail,
  isSelf,
  disabled = false,
}: CreateUserWorkspaceButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (isSelf) return null;

  function onOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setName("");
      setError(null);
    }
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Workspace name is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createTeamWorkspaceForUserAction({
          targetUserId,
          name: trimmed,
        });
        setOpen(false);
        setName("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create workspace.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button" variant="outline" size="xs" disabled={disabled} />}>
        New workspace
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create workspace for user</DialogTitle>
          <DialogDescription>
            Create a team workspace for this subscriber. This requires the user to have a team-tier
            plan assigned.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{targetUserName}</p>
            <p>{targetUserEmail ?? "No email"}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`workspace-name-${targetUserId}`}>Workspace name</Label>
            <Input
              id={`workspace-name-${targetUserId}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Team"
              maxLength={255}
              disabled={isPending}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending ? "Creating..." : "Create workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
