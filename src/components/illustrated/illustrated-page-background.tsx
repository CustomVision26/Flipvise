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
            unoptimized
            className="illustrated-page-bg-art illustrated-page-bg-art-left"
            style={{
              top: "var(--bg-art-top, 11%)",
              height: "var(--bg-art-height, 78%)",
              width: "var(--bg-art-width, auto)",
              maxWidth: "var(--bg-art-max-width, none)",
              maxHeight: `min(var(--bg-art-max-height, 100%), ${Math.round(theme.leftHeight / 2)}px)`,
            }}
            onError={() => setFailed((current) => ({ ...current, left: true }))}
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
            unoptimized
            className="illustrated-page-bg-art illustrated-page-bg-art-right"
            style={{
              top: "var(--bg-art-top, 11%)",
              height: "var(--bg-art-height, 78%)",
              width: "var(--bg-art-width, auto)",
              maxWidth: "var(--bg-art-max-width, none)",
              maxHeight: `min(var(--bg-art-max-height, 100%), ${Math.round(theme.rightHeight / 2)}px)`,
            }}
            onError={() => setFailed((current) => ({ ...current, right: true }))}
          />
        </div>
      ) : null}
    </div>
  );
}
