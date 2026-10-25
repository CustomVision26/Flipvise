"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { resolveIllustratedArtwork } from "@/lib/illustrated-reference-bank";
import { IllustratedScene } from "@/components/illustrated/illustrated-scene";

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
}: {
  children: ReactNode;
  className?: string;
}) {
  const { effectiveReducedMotion } = useIllustratedAppearance();
  return (
    <div
      className={cn(
        "illustrated-stack relative",
        effectiveReducedMotion && "illustrated-stack-still",
        className,
      )}
    >
      <span className="illustrated-layer illustrated-layer-a" aria-hidden />
      <span className="illustrated-layer illustrated-layer-b" aria-hidden />
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
    <IllustratedCardStack className={className}>
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
    <IllustratedCardStack className={cn("mx-auto w-full max-w-lg", className)}>
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
  deckDescription,
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
  const art = resolveIllustratedArtwork({
    name: deckName,
    description: deckDescription,
  });
  return (
    <div className="illustrated-quiz-prep relative mx-auto w-full max-w-3xl">
      <div className="mb-3 overflow-hidden rounded-2xl" aria-hidden>
        <div className="relative h-32 sm:h-40">
          <IllustratedScene
            subject={art.subject}
            text={`${deckName} ${deckDescription ?? ""}`}
            role="hero"
            fit="contain"
            displayWidth={720}
            displayHeight={160}
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1e1b4b]/80 to-transparent p-4">
            <p className="text-lg font-semibold text-white [overflow-wrap:anywhere]">{deckName}</p>
          </div>
        </div>
      </div>
      <div className="relative">
        <div
          className={cn(
            "pointer-events-none absolute -left-2 bottom-6 z-10 hidden sm:block",
            !effectiveReducedMotion && "illustrated-quiz-props",
          )}
          aria-hidden
        >
          <span className="relative block h-24 w-20">
            <IllustratedScene prop="quiz-stopwatch" displayWidth={80} displayHeight={96} />
          </span>
        </div>
        <div
          className="pointer-events-none absolute -right-1 top-4 z-10 hidden sm:block"
          aria-hidden
        >
          <span className="relative block h-24 w-20">
            <IllustratedScene prop="quiz-pencil" displayWidth={80} displayHeight={96} />
          </span>
        </div>
        <IllustratedCardStack>{children}</IllustratedCardStack>
      </div>
    </div>
  );
}
