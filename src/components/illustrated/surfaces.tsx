"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { SubjectKey } from "@/lib/illustrated-appearance";
import { resolveIllustratedArtwork } from "@/lib/illustrated-reference-bank";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import { IllustratedDeckHero, IllustratedQuizPrepFrame } from "@/components/illustrated/shell";
import { IllustratedScene } from "@/components/illustrated/illustrated-scene";
import type { IllustratedAssetRole } from "@/lib/illustrated-asset-manifest";

export function DeckArtwork({
  subject,
  coverImageUrl,
  referenceImageUrl,
  topicText,
  variantIndex,
  role = "hero",
  displayWidth = 360,
  displayHeight = 200,
  decorativeCover = false,
  className,
}: {
  subject: SubjectKey;
  coverImageUrl?: string | null;
  referenceImageUrl?: string | null;
  topicText?: string | null;
  variantIndex?: number | null;
  role?: IllustratedAssetRole;
  displayWidth?: number;
  displayHeight?: number;
  /** Opaque deck-bank cover. Kept inside the frame instead of a transparent hero. */
  decorativeCover?: boolean;
  className?: string;
}) {
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);
  const photo = coverImageUrl && failedCoverUrl !== coverImageUrl ? coverImageUrl : null;
  void referenceImageUrl;
  return (
    <div className="relative h-full w-full">
      {photo ? (
        <Image
          src={photo}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 768px"
          className={cn(decorativeCover ? "object-contain" : "object-cover", className)}
          onError={() => {
            if (coverImageUrl) setFailedCoverUrl(coverImageUrl);
          }}
        />
      ) : (
        <IllustratedScene
          subject={subject}
          text={topicText}
          variantIndex={variantIndex}
          role={role}
          displayWidth={displayWidth}
          displayHeight={displayHeight}
          fit={role === "hero" ? "contain" : "cover"}
          className={className}
        />
      )}
    </div>
  );
}

export function IllustratedStack({
  subject,
  coverImageUrl,
  referenceImageUrl,
  topicText,
  variantIndex,
  role = "hero",
  displayWidth = 360,
  displayHeight = 200,
  decorativeCover = false,
  art,
  children,
  className,
  artClassName,
}: {
  subject: SubjectKey;
  coverImageUrl?: string | null;
  referenceImageUrl?: string | null;
  topicText?: string | null;
  variantIndex?: number | null;
  role?: IllustratedAssetRole;
  displayWidth?: number;
  displayHeight?: number;
  decorativeCover?: boolean;
  art?: ReactNode;
  children: ReactNode;
  className?: string;
  artClassName?: string;
}) {
  const { effectiveReducedMotion } = useIllustratedAppearance();
  return (
    <div
      className={cn(
        "illustrated-stack relative flex flex-col",
        effectiveReducedMotion && "illustrated-stack-still",
        className,
      )}
    >
      <span className="illustrated-layer illustrated-layer-a" aria-hidden />
      <span className="illustrated-layer illustrated-layer-b" aria-hidden />
      <div className="illustrated-face relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#eadfce] bg-[#fff8ee] text-slate-900 shadow-lg">
        <div
          className={cn(
            "relative h-40 w-full shrink-0 overflow-hidden sm:h-44",
            decorativeCover
              ? "illustrated-blend-cover aspect-[3/2] bg-[#fff8ee]"
              : "aspect-[16/9] bg-muted",
            artClassName,
          )}
        >
          {art ?? (
            <DeckArtwork
              subject={subject}
              coverImageUrl={coverImageUrl}
              referenceImageUrl={referenceImageUrl}
              topicText={topicText}
              variantIndex={variantIndex}
              role={role}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              decorativeCover={decorativeCover}
            />
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function IllustratedDeckTile({
  name,
  description,
  gradeLevel,
  coverImageUrl,
  subject,
  cardCount,
  updatedLabel,
  className,
}: {
  name: string;
  description?: string | null;
  gradeLevel?: string | null;
  coverImageUrl?: string | null;
  subject?: string | null;
  cardCount: number;
  updatedLabel: string;
  className?: string;
}) {
  const art = resolveIllustratedArtwork({
    name,
    description,
    gradeLevel,
    coverImageUrl,
    subject,
  });
  const empty = cardCount === 0;
  return (
    <IllustratedStack
      subject={art.subject}
      referenceImageUrl={art.referenceImageUrl}
      className={cn("illustrated-readable h-full", className)}
      topicText={`${name} ${description ?? ""}`}
      role="hero"
      displayWidth={360}
      displayHeight={240}
    >
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <p className="line-clamp-3 text-base font-semibold leading-snug tracking-tight text-slate-900 [overflow-wrap:anywhere]">
          {name}
        </p>
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 sm:text-sm [overflow-wrap:anywhere]">
          {description?.trim() ? description : "No description provided."}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs tabular-nums text-slate-600">
          <span className="font-medium text-slate-900">
            {empty ? "No cards yet" : `${cardCount} ${cardCount === 1 ? "card" : "cards"}`}
          </span>
          <span className="truncate text-right">{updatedLabel}</span>
        </div>
      </div>
    </IllustratedStack>
  );
}

export function IllustratedCardTile({
  subject,
  coverImageUrl,
  referenceImageUrl,
  topicText,
  variantIndex,
  art,
  children,
  footer,
}: {
  subject: SubjectKey;
  coverImageUrl?: string | null;
  referenceImageUrl?: string | null;
  topicText?: string | null;
  variantIndex?: number | null;
  art?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <IllustratedStack
      subject={subject}
      coverImageUrl={coverImageUrl}
      referenceImageUrl={referenceImageUrl}
      topicText={topicText}
      variantIndex={variantIndex}
      role="card-cover"
      displayWidth={360}
      displayHeight={160}
      art={art}
      artClassName="h-40 shrink-0 aspect-auto bg-[#f6f1e8]"
      className="illustrated-card-tile illustrated-readable h-[18.5rem]"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="min-h-0 flex-1 overflow-hidden text-sm leading-snug text-slate-900 [overflow-wrap:anywhere]">
          {children}
        </div>
        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </IllustratedStack>
  );
}

export function IllustratedDeckHeader({
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
  return (
    <IllustratedDeckHero
      name={name}
      description={description}
      gradeLevel={gradeLevel}
      coverImageUrl={coverImageUrl}
      className={className}
    >
      {children}
    </IllustratedDeckHero>
  );
}

export function IllustratedQuizFrame({
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
  return (
    <IllustratedQuizPrepFrame
      active={active}
      deckName={deckName}
      deckDescription={deckDescription}
    >
      {children}
    </IllustratedQuizPrepFrame>
  );
}

