"use client";

import { cn } from "@/lib/utils";
import { isStepAnswer, parseStepAnswer } from "@/lib/parse-step-answer";

type FormattedCardAnswerProps = {
  text: string;
  /** Hover preview vs full-size study card back */
  variant?: "hover" | "study";
  hasGradient?: boolean;
  revealKey?: number;
  className?: string;
};

export function FormattedCardAnswer({
  text,
  variant = "hover",
  hasGradient = false,
  revealKey = 0,
  className,
}: FormattedCardAnswerProps) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const isStudy = variant === "study";
  const lineDelay = (index: number) => `${0.38 + index * 0.11}s`;

  if (!isStepAnswer(trimmed)) {
    if (!trimmed.includes("\n")) {
      return (
        <p
          key={revealKey}
          className={cn(
            isStudy
              ? "animate-magic-answer-reveal w-full text-left text-base font-medium leading-relaxed break-words sm:text-lg md:text-xl"
              : "text-base font-medium leading-relaxed break-words whitespace-pre-wrap",
            hasGradient && isStudy && "text-white",
            className,
          )}
        >
          {trimmed}
        </p>
      );
    }

    return (
      <div
        key={revealKey}
        className={cn(
          "w-full space-y-2 text-left",
          isStudy ? "space-y-2" : "text-base leading-relaxed",
          className,
        )}
      >
        {trimmed
          .split(/\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line, i) => (
            <p
              key={i}
              className={cn(
                isStudy && "animate-magic-line-reveal break-words",
                isStudy
                  ? cn(
                      "text-sm font-normal leading-relaxed sm:text-base md:text-lg",
                      hasGradient ? "text-white/90" : "text-foreground/90",
                    )
                  : "font-medium text-foreground break-words",
              )}
              style={isStudy ? { animationDelay: lineDelay(i) } : undefined}
            >
              {line}
            </p>
          ))}
      </div>
    );
  }

  const blocks = parseStepAnswer(trimmed);
  let lineIndex = 0;

  return (
    <div
      key={revealKey}
      className={cn(
        "flex w-full flex-col",
        isStudy ? "gap-2 sm:gap-2.5" : "gap-2.5",
        className,
      )}
    >
      {blocks.map((block, blockIndex) => {
        if (block.kind === "step") {
          const delay = lineDelay(lineIndex++);
          const stepTitle = block.title || `Step ${block.stepNumber}`;

          if (isStudy) {
            return (
              <div
                key={`step-${blockIndex}`}
                className={cn(
                  "animate-magic-line-reveal rounded-lg border px-3 py-2.5 sm:px-4",
                  hasGradient
                    ? "border-white/20 bg-white/10"
                    : "border-border/70 bg-muted/25",
                )}
                style={{ animationDelay: delay }}
              >
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums sm:size-7 sm:text-xs",
                      hasGradient
                        ? "bg-white/20 text-white"
                        : "bg-primary/15 text-primary",
                    )}
                  >
                    {block.stepNumber}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold leading-snug break-words sm:text-base",
                        hasGradient ? "text-white" : "text-foreground",
                      )}
                    >
                      {stepTitle}
                    </p>
                    {block.work.map((workLine, workIndex) => {
                      const workDelay = lineDelay(lineIndex++);
                      return (
                        <p
                          key={workIndex}
                          className={cn(
                            "animate-magic-line-reveal mt-1.5 font-mono text-xs leading-relaxed break-words sm:text-sm",
                            hasGradient ? "text-white/85" : "text-muted-foreground",
                          )}
                          style={{ animationDelay: workDelay }}
                        >
                          {workLine}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`step-${blockIndex}`}
              className="rounded-md border border-border/60 bg-muted/20 px-3 py-2.5"
            >
              <div className="flex items-start gap-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary tabular-nums">
                  {block.stepNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground break-words">
                    {stepTitle}
                  </p>
                  {block.work.map((workLine, workIndex) => (
                    <p
                      key={workIndex}
                      className="mt-1.5 font-mono text-xs leading-relaxed text-muted-foreground break-words"
                    >
                      {workLine}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        if (block.kind === "final") {
          const delay = lineDelay(lineIndex++);

          if (isStudy) {
            return (
              <div
                key={`final-${blockIndex}`}
                className={cn(
                  "animate-magic-line-reveal-glow rounded-lg border px-3 py-2.5 sm:px-4",
                  hasGradient
                    ? "border-white/25 bg-white/10"
                    : "border-emerald-500/35 bg-emerald-500/10",
                )}
                style={{ "--magic-line-delay": delay } as React.CSSProperties}
              >
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px]",
                    hasGradient ? "text-white/80" : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {block.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-sm font-bold leading-snug break-words sm:text-base md:text-lg",
                    hasGradient ? "text-white" : "text-foreground",
                  )}
                >
                  {block.value}
                </p>
              </div>
            );
          }

          return (
            <div
              key={`final-${blockIndex}`}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                {block.label}
              </p>
              <p className="mt-1 text-base font-bold leading-relaxed text-foreground break-words">
                {block.value}
              </p>
            </div>
          );
        }

        const delay = lineDelay(lineIndex++);
        return (
          <p
            key={`line-${blockIndex}`}
            className={cn(
              isStudy && "animate-magic-line-reveal break-words",
              isStudy
                ? cn("text-sm sm:text-base", hasGradient ? "text-white/90" : "text-foreground")
                : "text-sm text-foreground break-words leading-relaxed",
            )}
            style={isStudy ? { animationDelay: delay } : undefined}
          >
            {block.text}
          </p>
        );
      })}
    </div>
  );
}
