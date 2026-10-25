"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { resolveIllustratedArtwork } from "@/lib/illustrated-reference-bank";
import { IllustratedScene } from "@/components/illustrated/illustrated-scene";
import { peekLayerColors } from "@/lib/illustrated-peek-colors";

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
        <div className="relative mx-auto mb-4 h-36 w-36" aria-hidden>
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
  if (active) {
    return <div className="illustrated-quiz-live illustrated-readable">{children}</div>;
  }
  return (
    <div className="illustrated-quiz-prep relative mx-auto w-full max-w-3xl overflow-visible">
      <div className="relative overflow-visible">
        <div
          className={cn(
            "pointer-events-none absolute -left-6 bottom-4 z-20 hidden sm:block md:-left-16",
            !effectiveReducedMotion && "illustrated-quiz-props",
          )}
          aria-hidden
        >
          <span className="relative block h-52 w-44 md:h-64 md:w-56">
            <IllustratedScene
              prop="quiz-stopwatch"
              fit="contain"
              displayWidth={224}
              displayHeight={256}
            />
          </span>
        </div>
        <div
          className="pointer-events-none absolute -right-4 top-2 z-20 hidden sm:block md:-right-12"
          aria-hidden
        >
          <span className="relative block h-56 w-48 md:h-72 md:w-60">
            <IllustratedScene
              prop="quiz-pencil"
              fit="contain"
              displayWidth={240}
              displayHeight={288}
            />
          </span>
        </div>
        <IllustratedCardStack seed={`${deckName}-quiz`}>{children}</IllustratedCardStack>
      </div>
    </div>
  );
}
