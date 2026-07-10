"use client";

import { cn } from "@/lib/utils";
import {
  parseCardFront,
  parseDefinitionItems,
  hasStructuredPassageBody,
  type ParsedPassageBody,
} from "@/lib/format-card-content";

type FormattedCardFrontProps = {
  text: string;
  /** Flashcard review vs timed quiz vs deck preview */
  variant?: "study" | "quiz" | "preview";
  hasGradient?: boolean;
  className?: string;
};

function sectionLabelClass(hasGradient: boolean, variant: FormattedCardFrontProps["variant"]) {
  return cn(
    "font-semibold uppercase tracking-[0.14em]",
    variant === "study"
      ? "text-[10px] sm:text-[11px]"
      : variant === "quiz"
        ? "text-[10px]"
        : "text-[10px]",
    hasGradient ? "text-white/75" : "text-muted-foreground",
  );
}

function passageBodyClass(hasGradient: boolean, variant: FormattedCardFrontProps["variant"]) {
  return cn(
    "font-normal leading-relaxed break-words",
    variant === "study"
      ? "text-sm sm:text-base md:text-lg"
      : variant === "quiz"
        ? "text-sm sm:text-base"
        : "text-sm sm:text-base",
    hasGradient ? "text-white/90" : "text-foreground/90",
  );
}

function questionTextClass(hasGradient: boolean, variant: FormattedCardFrontProps["variant"]) {
  return cn(
    "font-medium leading-snug break-words",
    variant === "study"
      ? "text-base sm:text-lg md:text-xl"
      : variant === "quiz"
        ? "text-base sm:text-lg"
        : "text-base sm:text-lg",
    hasGradient ? "text-white" : "text-foreground",
  );
}

function plainTextClass(hasGradient: boolean, variant: FormattedCardFrontProps["variant"]) {
  return cn(
    "w-full text-left font-normal leading-relaxed break-words whitespace-pre-line",
    variant === "study"
      ? "text-sm sm:text-base md:text-lg"
      : "text-sm sm:text-base",
    hasGradient ? "text-white/95" : "text-foreground/95",
  );
}

function PassageBody({
  body,
  hasGradient,
  variant,
}: {
  body: ParsedPassageBody;
  hasGradient: boolean;
  variant: FormattedCardFrontProps["variant"];
}) {
  const bodyClass = passageBodyClass(hasGradient, variant);
  const labelClass = sectionLabelClass(hasGradient, variant);
  const cardBorder = hasGradient ? "border-white/15 bg-white/5" : "border-border/60 bg-muted/10";

  return (
    <div className="space-y-4">
      {body.intro ? (
        <div className="space-y-2">
          <p className={labelClass}>Passage</p>
          <p className={bodyClass}>{body.intro}</p>
        </div>
      ) : null}
      {body.paragraphs.map((paragraph, index) => (
        <p key={`p-${index}`} className={bodyClass}>
          {paragraph}
        </p>
      ))}
      {body.definitions.length > 0 ? (
        <div className="space-y-2.5">
          <p className={labelClass}>Key terms</p>
          <ul className="space-y-2.5 pl-0 list-none">
            {body.definitions.map((item) => (
              <li key={item.term} className={cn("rounded-lg border px-3 py-2.5 sm:px-3.5", cardBorder)}>
                <p className={bodyClass}>
                  <span className={cn("font-semibold", hasGradient ? "text-white" : "text-foreground")}>
                    {item.term}
                  </span>
                  <span className={cn("mx-1.5", hasGradient ? "text-white/50" : "text-muted-foreground/70")}>
                    —
                  </span>
                  <span>{item.definition}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function FormattedCardFront({
  text,
  variant = "study",
  hasGradient = false,
  className,
}: FormattedCardFrontProps) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parsed = parseCardFront(trimmed);
  const labelClass = sectionLabelClass(hasGradient, variant);
  const questionClass = questionTextClass(hasGradient, variant);

  if (parsed.kind === "reading-passage") {
    return (
      <div className={cn("w-full space-y-4 text-left", className)}>
        <PassageBody body={parsed.passage} hasGradient={hasGradient} variant={variant} />
        <div
          className={cn(
            "space-y-2.5 border-t pt-4",
            hasGradient ? "border-white/20" : "border-border/60",
          )}
        >
          <p className={labelClass}>Question</p>
          <p className={questionClass}>{parsed.question}</p>
        </div>
      </div>
    );
  }

  const structured = parseDefinitionItems(parsed.text);
  if (hasStructuredPassageBody(structured)) {
    return (
      <div className={cn("w-full text-left", className)}>
        <PassageBody body={structured} hasGradient={hasGradient} variant={variant} />
      </div>
    );
  }

  const isShortSingleLine = !parsed.text.includes("\n") && parsed.text.length <= 90;

  return (
    <p
      className={cn(
        plainTextClass(hasGradient, variant),
        isShortSingleLine && variant === "study" && "text-center font-medium",
        isShortSingleLine && variant === "study"
          ? "text-lg sm:text-xl md:text-2xl"
          : null,
        className,
      )}
    >
      {parsed.text}
    </p>
  );
}
