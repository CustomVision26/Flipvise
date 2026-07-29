"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { assignEssayToMemberAction } from "@/actions/essay";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export type EssayAssignMemberOption = {
  userId: string;
  label: string;
};

type EssayAssignDialogProps = {
  documentId: number;
  teamId: number;
  members: EssayAssignMemberOption[];
};

export function EssayAssignDialog({
  documentId,
  teamId,
  members,
}: EssayAssignDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [assigneeUserId, setAssigneeUserId] = React.useState(
    members[0]?.userId ?? "",
  );
  const [pending, setPending] = React.useState(false);

  if (members.length === 0) return null;

  async function onAssign() {
    if (!assigneeUserId) return;
    setPending(true);
    try {
      await assignEssayToMemberAction({
        documentId,
        teamId,
        assigneeUserId,
      });
      toast.success("Essay assigned");
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Assign to member
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign essay</DialogTitle>
          <DialogDescription>
            Assign this activity to a Team Admin workspace member. They will see it
            under Assignments.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label>Member</Label>
          <Select
            value={assigneeUserId}
            onValueChange={(value) => setAssigneeUserId(value ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={pending || !assigneeUserId}
            onClick={() => void onAssign()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
