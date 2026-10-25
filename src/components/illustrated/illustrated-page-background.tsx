"use client";

import { useState } from "react";
import Image from "next/image";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import {
  resolveIllustratedPageTheme,
  type IllustratedPageTheme,
} from "@/lib/illustrated-page-theme";

export function IllustratedPageBackground({
  name,
  description,
  gradeLevel,
  subject,
  theme: themeProp,
}: {
  name?: string | null;
  description?: string | null;
  gradeLevel?: string | null;
  subject?: string | null;
  /** Already resolved by the deck layout. Skips a second lookup. */
  theme?: IllustratedPageTheme;
}) {
  const { effectiveIllustratedDesign } = useIllustratedAppearance();
  const [failed, setFailed] = useState<{ left?: boolean; right?: boolean }>({});
  if (!effectiveIllustratedDesign) return null;

  const theme =
    themeProp ??
    resolveIllustratedPageTheme({ name, description, gradeLevel, subject });
  const showLeft = Boolean(theme.left) && !failed.left;
  const showRight = Boolean(theme.right) && !failed.right;

  return (
    <div className="illustrated-page-bg" data-illustrated-theme={theme.subject} aria-hidden>
      <div className="illustrated-page-bg-base" style={{ background: theme.base }} />
      {showLeft && theme.left ? (
        <div className="illustrated-page-bg-slot illustrated-page-bg-slot-left">
          <Image
            src={theme.left}
            alt=""
            width={theme.leftWidth}
            height={theme.leftHeight}
            sizes="(max-width: 767px) 28vw, 38vh"
            className="illustrated-page-bg-art illustrated-page-bg-art-left"
            style={{
              top: "var(--bg-art-top, 11%)",
              height: "var(--bg-art-height, 78%)",
              width: "var(--bg-art-width, auto)",
              maxWidth: "var(--bg-art-max-width, none)",
              maxHeight: "var(--bg-art-max-height, none)",
            }}
            onError={() => setFailed((current) => ({ ...current, left: true }))}
          />
          <span
            className="illustrated-page-bg-gloss illustrated-page-bg-gloss-left"
            style={{
              aspectRatio: `${theme.leftWidth} / ${theme.leftHeight}`,
              WebkitMaskImage: `url(${theme.left})`,
              maskImage: `url(${theme.left})`,
            }}
          />
        </div>
      ) : null}
      {showRight && theme.right ? (
        <div className="illustrated-page-bg-slot illustrated-page-bg-slot-right">
          <Image
            src={theme.right}
            alt=""
            width={theme.rightWidth}
            height={theme.rightHeight}
            sizes="(max-width: 767px) 28vw, 38vh"
            className="illustrated-page-bg-art illustrated-page-bg-art-right"
            style={{
              top: "var(--bg-art-top, 11%)",
              height: "var(--bg-art-height, 78%)",
              width: "var(--bg-art-width, auto)",
              maxWidth: "var(--bg-art-max-width, none)",
              maxHeight: "var(--bg-art-max-height, none)",
            }}
            onError={() => setFailed((current) => ({ ...current, right: true }))}
          />
          <span
            className="illustrated-page-bg-gloss illustrated-page-bg-gloss-right"
            style={{
              aspectRatio: `${theme.rightWidth} / ${theme.rightHeight}`,
              WebkitMaskImage: `url(${theme.right})`,
              maskImage: `url(${theme.right})`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
