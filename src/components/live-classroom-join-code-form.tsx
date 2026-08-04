"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleHelp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { joinLiveClassroomByCodeAction } from "@/actions/live-classroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { liveClassroomLobbyPath } from "@/lib/live-classroom-url";

const CAPTION_JOIN_CODE =
  "Enter the join code shown in the host’s lobby. You must be assigned to the Live Classroom™ team for this workspace. Join with the code only — there is no lobby link.";

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
        render={(props) => (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            {...props}
            className={cn(
              "size-7 shrink-0 text-muted-foreground hover:text-foreground",
              props.className,
            )}
            aria-label={`${fieldLabel} — help`}
          >
            <CircleHelp className="size-4 shrink-0" aria-hidden />
          </Button>
        )}
      />
      <TooltipContent side="top" className="max-w-xs text-pretty text-left">
        <span className="block text-xs leading-snug">{caption}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export function LiveClassroomJoinCodeForm({
  compact = false,
  hintCaption = CAPTION_JOIN_CODE,
  inputId = "lc-join-code",
}: {
  compact?: boolean;
  hintCaption?: string;
  inputId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [joinCode, setJoinCode] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const result = await joinLiveClassroomByCodeAction({ joinCode });
        toast.success("Joined session");
        router.push(liveClassroomLobbyPath(result.sessionId));
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not join session",
        );
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        compact
          ? "flex flex-col gap-2 sm:flex-row sm:items-end"
          : "space-y-4",
      )}
    >
      <div className={cn(compact ? "min-w-0 flex-1 space-y-1" : "space-y-2")}>
        <div className="flex items-center gap-1">
          <Label
            htmlFor={inputId}
            className={cn(compact && "text-xs text-muted-foreground")}
          >
            Join code
          </Label>
          <HintBalloon fieldLabel="Join code" caption={hintCaption} />
        </div>
        <Input
          id={inputId}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder="e.g. REUNMK"
          autoComplete="off"
          spellCheck={false}
          maxLength={16}
          className={cn(
            "font-mono tracking-widest uppercase",
            compact && "h-9",
          )}
          required
        />
      </div>
      <Button
        type="submit"
        size={compact ? "sm" : "default"}
        disabled={pending || !joinCode.trim()}
        className="gap-2 sm:shrink-0"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Join lobby
      </Button>
    </form>
  );
}
