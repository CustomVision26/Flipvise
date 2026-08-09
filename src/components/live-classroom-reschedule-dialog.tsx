"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateLiveClassroomSessionSettingsAction } from "@/actions/live-classroom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Local `YYYY-MM-DDTHH:mm` string for an <input type="datetime-local">, min 1 minute out. */
function defaultLocalDateTime(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LiveClassroomRescheduleDialog({
  open,
  onOpenChange,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: number;
}) {
  const [value, setValue] = useState(defaultLocalDateTime);
  const [pending, startTransition] = useTransition();

  function save() {
    const local = new Date(value);
    if (Number.isNaN(local.getTime())) {
      toast.error("Pick a valid date and time.");
      return;
    }
    if (local.getTime() <= Date.now()) {
      toast.error("Pick a date and time in the future.");
      return;
    }
    startTransition(async () => {
      try {
        await updateLiveClassroomSessionSettingsAction({
          sessionId,
          scheduledFor: local.toISOString(),
        });
        toast.success("Battle rescheduled");
        onOpenChange(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not reschedule battle",
        );
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reschedule battle</DialogTitle>
          <DialogDescription>
            The scheduled time has passed. Pick a new date and time to start
            the countdown again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="lc-reschedule-datetime">New date &amp; time</Label>
          <Input
            id="lc-reschedule-datetime"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            min={defaultLocalDateTime()}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
