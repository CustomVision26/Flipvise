"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { resolveIllustratedArtwork } from "@/lib/illustrated-reference-bank";
import { IllustratedScene } from "@/components/illustrated/illustrated-scene";
import { peekLayerColors } from "@/lib/illustrated-peek-colors";
import type { IllustratedProp } from "@/lib/illustrated-asset-manifest";

export function IllustratedStudyShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { effectiveIllustratedDesign } = useIllustratedAppearance();
  if (!effectiveIllustratedDesign) return <div className={className}>{children}</div>;
  return (
    <div className={cn("illustrated-study-shell flex flex-col gap-4", className)}>
      {children}
    </div>
  );
}

export function IllustratedCardStack({
  children,
  className,
  seed = "stack",
}: {
  children: ReactNode;
  className?: string;
  seed?: number | string;
}) {
  const { effectiveReducedMotion } = useIllustratedAppearance();
  const peek = peekLayerColors(seed);
  return (
    <div
      className={cn(
        "illustrated-stack relative",
        effectiveReducedMotion && "illustrated-stack-still",
        className,
      )}
    >
      <span
        className="illustrated-layer illustrated-layer-a"
        style={{ background: peek.layerA }}
        aria-hidden
      />
      <span
        className="illustrated-layer illustrated-layer-b"
        style={{ background: peek.layerB }}
        aria-hidden
      />
      <div className="illustrated-face relative z-[1]">{children}</div>
    </div>
  );
}

export function IllustratedDeckHero({
  name,
  description,
  gradeLevel,
  coverImageUrl,
  className,
  children,
}: {
  name: string;
  description?: string | null;
  gradeLevel?: string | null;
  coverImageUrl?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const { effectiveIllustratedDesign } = useIllustratedAppearance();
  if (!effectiveIllustratedDesign) return <div className={className}>{children}</div>;
  const art = resolveIllustratedArtwork({ name, description, gradeLevel, coverImageUrl });
  return (
    <IllustratedCardStack className={cn(className, "illustrated-stack-plain")}>
      <div className="grid items-stretch gap-3 rounded-2xl bg-[#fff8ee] p-3 text-slate-900 sm:p-4 lg:grid-cols-[minmax(17rem,24rem)_minmax(14rem,1fr)]">
        <div className="illustrated-ink min-w-0">{children}</div>
        <div className="illustrated-hero-art relative min-h-40" aria-hidden>
          <IllustratedScene
            subject={art.subject}
            text={`${name} ${description ?? ""}`}
            role="hero"
            fit="contain"
            displayWidth={448}
            displayHeight={280}
          />
        </div>
      </div>
    </IllustratedCardStack>
  );
}

export function IllustratedQuestionSurface({
  children,
  deckName,
  deckDescription,
  showArt = true,
  className,
}: {
  children: ReactNode;
  deckName?: string;
  deckDescription?: string | null;
  showArt?: boolean;
  className?: string;
}) {
  const art = resolveIllustratedArtwork({
    name: deckName,
    description: deckDescription,
  });
  return (
    <IllustratedCardStack className={className} seed={deckName ?? "question"}>
      <div className="overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fff8ee] text-slate-900 shadow-md">
        {showArt ? (
          <div className="relative h-28 w-full sm:h-36" aria-hidden>
            <IllustratedScene
              subject={art.subject}
              text={deckName}
              role="hero"
              fit="contain"
              displayWidth={640}
              displayHeight={144}
            />
          </div>
        ) : null}
        {children}
      </div>
    </IllustratedCardStack>
  );
}

export function IllustratedInfoPanel({
  deckName,
  children,
  className,
}: {
  deckName: string;
  deckDescription?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const { effectiveIllustratedDesign } = useIllustratedAppearance();
  if (!effectiveIllustratedDesign) {
    return <div className={className}>{children}</div>;
  }
  return (
    <IllustratedCardStack className={cn("mx-auto w-full max-w-lg", className)} seed={deckName}>
      <div className="illustrated-readable rounded-2xl border border-[#eadfce] bg-[#fff8ee] p-6 text-center text-slate-900 sm:p-8">
        <div className="study-art-arrive relative mx-auto mb-4 h-36 w-36" aria-hidden>
          <IllustratedScene prop="ai-recall-intro" displayWidth={144} displayHeight={144} />
        </div>
        {children}
      </div>
    </IllustratedCardStack>
  );
}

export function IllustratedModeTabs({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { effectiveIllustratedDesign } = useIllustratedAppearance();
  return (
    <div className={cn(effectiveIllustratedDesign && "illustrated-mode-tabs", className)}>
      {children}
    </div>
  );
}

export function IllustratedAnswerOption({
  children,
  selected,
  className,
}: {
  children: ReactNode;
  selected?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#eadfce] bg-white px-3 py-2 text-slate-900",
        selected && "border-violet-500 bg-violet-50",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IllustratedPeekFrame({
  seed,
  className,
  children,
}: {
  seed: number | string;
  className?: string;
  children: ReactNode;
}) {
  const { effectiveIllustratedDesign, effectiveReducedMotion } = useIllustratedAppearance();
  if (!effectiveIllustratedDesign) return <div className={className}>{children}</div>;
  const peek = peekLayerColors(seed);
  return (
    <div
      className={cn(
        "illustrated-stack relative",
        effectiveReducedMotion && "illustrated-stack-still",
        className,
      )}
    >
      <span
        className="illustrated-layer illustrated-layer-a"
        style={{ background: peek.layerA }}
        aria-hidden
      />
      <span
        className="illustrated-layer illustrated-layer-b"
        style={{ background: peek.layerB }}
        aria-hidden
      />
      <div className="illustrated-face relative z-[1]">{children}</div>
    </div>
  );
}

export function IllustratedActionButton({
  children,
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button className={cn("rounded-full", className)} {...props}>
      {children}
    </Button>
  );
}

export function IllustratedQuizPrepFrame({
  active,
  deckName,
  children,
}: {
  active: boolean;
  deckName: string;
  deckDescription?: string | null;
  children: ReactNode;
}) {
  const { effectiveIllustratedDesign, effectiveReducedMotion } =
    useIllustratedAppearance();
  if (!effectiveIllustratedDesign) return <>{children}</>;
  return (
    <div
      className={cn(
        "illustrated-quiz-prep relative mx-auto w-full max-w-3xl overflow-visible",
        active
          ? "illustrated-quiz-live"
          : "pt-8 pb-28 sm:pt-10 sm:pb-36",
      )}
    >
      <div className="relative overflow-visible">
        <div
          className={cn(
            "pointer-events-none absolute hidden sm:block",
            active
              ? "right-full top-2 z-0 mr-4"
              : "left-0 top-0 z-20 -translate-x-6 md:-translate-x-10",
            !effectiveReducedMotion && "illustrated-quiz-props",
          )}
          aria-hidden
        >
          <span className={cn("relative block", active ? "h-20 w-20 md:h-24 md:w-24" : "h-28 w-28 md:h-40 md:w-40")}>
            <IllustratedScene
              prop="quiz-stars"
              fit="contain"
              displayWidth={160}
              displayHeight={160}
            />
          </span>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute hidden sm:block",
            active
              ? "left-full top-2 z-0 ml-4"
              : "right-0 top-0 z-20 translate-x-4 md:translate-x-8",
          )}
          aria-hidden
        >
          <span className={cn("relative block", active ? "h-16 w-16 md:h-20 md:w-20" : "h-24 w-24 md:h-32 md:w-32")}>
            <IllustratedScene
              prop="quiz-stars"
              fit="contain"
              displayWidth={128}
              displayHeight={128}
            />
          </span>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute hidden sm:block",
            active
              ? "right-full bottom-4 z-0 mr-3"
              : "-left-6 bottom-10 z-20 md:-left-16",
            !effectiveReducedMotion && "illustrated-quiz-props",
          )}
          aria-hidden
        >
          <span className={cn("relative block", active ? "h-36 w-32 md:h-44 md:w-36" : "h-52 w-44 md:h-64 md:w-56")}>
            <IllustratedScene
              prop="quiz-stopwatch"
              fit="contain"
              displayWidth={224}
              displayHeight={256}
            />
          </span>
        </div>
        <div
          className={cn(
            "pointer-events-none absolute hidden sm:block",
            active
              ? "left-full top-24 z-0 ml-3"
              : "-right-4 top-16 z-20 md:-right-12",
          )}
          aria-hidden
        >
          <span className={cn("relative block", active ? "h-40 w-36 md:h-48 md:w-40" : "h-56 w-48 md:h-72 md:w-60")}>
            <IllustratedScene
              prop="quiz-pencil"
              fit="contain"
              displayWidth={240}
              displayHeight={288}
            />
          </span>
        </div>
        <div
          className="pointer-events-none absolute left-1/2 top-full z-0 mt-4 hidden w-56 -translate-x-1/2 sm:block md:w-72"
          aria-hidden
        >
          <span className="relative block h-20 w-full md:h-28">
            <IllustratedScene
              prop="quiz-spark"
              fit="contain"
              displayWidth={288}
              displayHeight={112}
            />
          </span>
        </div>
        {active ? (
          <div className="illustrated-readable relative z-10 isolate">{children}</div>
        ) : (
        <IllustratedCardStack
          className="illustrated-stack-plain relative z-10"
          seed={`${deckName}-quiz`}
        >
          {children}
        </IllustratedCardStack>
        )}
      </div>
    </div>
  );
}

type StudyOrbitSlot = "side-left" | "side-right" | "corner-left" | "corner-right";

const REVIEW_ORBIT: Array<{
  prop: IllustratedProp;
  slot: StudyOrbitSlot;
  displayWidth: number;
  displayHeight: number;
}> = [
  { prop: "review-cards", slot: "side-left", displayWidth: 176, displayHeight: 200 },
  { prop: "review-headphones", slot: "side-right", displayWidth: 176, displayHeight: 176 },
  { prop: "review-bulb", slot: "corner-right", displayWidth: 120, displayHeight: 140 },
];

const RECALL_ORBIT: Array<{
  prop: IllustratedProp;
  slot: StudyOrbitSlot;
  displayWidth: number;
  displayHeight: number;
}> = [
  { prop: "recall-mic", slot: "side-left", displayWidth: 150, displayHeight: 188 },
  { prop: "recall-keyboard", slot: "side-right", displayWidth: 200, displayHeight: 132 },
  { prop: "recall-bubbles", slot: "corner-left", displayWidth: 120, displayHeight: 120 },
  { prop: "recall-bubbles", slot: "corner-right", displayWidth: 104, displayHeight: 104 },
];

/** Floating study-mode props around a card. Hidden when Illustrated Deck Design is off. */
export function IllustratedStudyOrbit({
  variant,
  motionKey = 0,
  enterFrom = "next",
  className,
  children,
}: {
  variant: "review" | "recall";
  motionKey?: number | string;
  enterFrom?: "next" | "prev";
  className?: string;
  children: ReactNode;
}) {
  const { effectiveIllustratedDesign, effectiveReducedMotion } =
    useIllustratedAppearance();
  if (!effectiveIllustratedDesign) return <div className={className}>{children}</div>;
  const pieces = variant === "review" ? REVIEW_ORBIT : RECALL_ORBIT;
  return (
    <div
      className={cn("illustrated-study-orbit relative", className)}
      data-enter={enterFrom}
    >
      {pieces.map((piece) => (
        <div
          key={`${piece.slot}-${piece.prop}`}
          className={cn(
            "illustrated-study-prop pointer-events-none absolute z-20 hidden md:block",
            `illustrated-study-prop-${piece.slot}`,
          )}
          aria-hidden
        >
          <span
            key={`${motionKey}-${piece.slot}`}
            className={cn(
              "relative block h-full w-full",
              !effectiveReducedMotion && "illustrated-study-prop-motion",
            )}
          >
            <IllustratedScene
              prop={piece.prop}
              fit="contain"
              displayWidth={piece.displayWidth}
              displayHeight={piece.displayHeight}
            />
          </span>
        </div>
      ))}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
