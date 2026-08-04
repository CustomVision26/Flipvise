import { LiveClassroomJoinCodeForm } from "@/components/live-classroom-join-code-form";

type LiveClassroomStudyJoinCardProps = {
  sessionName?: string | null;
};

/** Compact Join with code strip for the deck study page when LC access is granted. */
export function LiveClassroomStudyJoinCard({
  sessionName,
}: LiveClassroomStudyJoinCardProps) {
  const sessionLabel = sessionName?.trim() || null;
  const hintCaption = sessionLabel
    ? `Enter the join code from the host’s lobby for “${sessionLabel}”. You must be assigned to the Live Classroom™ team. Join with the code only — there is no lobby link.`
    : "Enter the join code from the host’s lobby. You must be assigned to the Live Classroom™ team. Join with the code only — there is no lobby link.";

  return (
    <div className="mt-3 max-w-xl rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <p className="text-sm font-medium text-foreground">Join with code</p>
        {sessionLabel ? (
          <p className="truncate text-xs text-muted-foreground">
            {sessionLabel}
          </p>
        ) : null}
      </div>
      <LiveClassroomJoinCodeForm
        compact
        inputId="lc-study-join-code"
        hintCaption={hintCaption}
      />
    </div>
  );
}
