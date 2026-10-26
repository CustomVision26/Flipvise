"use client";

import Image from "next/image";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";
import {
  useBackgroundRotationNow,
  useEffectiveRotationStart,
} from "@/components/illustrated/use-background-rotation";
import { backgroundSceneStep } from "@/lib/illustrated-appearance";
import {
  illustratedThemeForSubject,
  rotateIllustratedPageTheme,
} from "@/lib/illustrated-page-theme";

const DASHBOARD_ART = [
  {
    src: "/illustrated/backgrounds/dashboard-study.png",
    className: "personal-dashboard-art personal-dashboard-art-study",
    width: 1024,
    height: 682,
  },
  {
    src: "/illustrated/backgrounds/dashboard-cards.png",
    className: "personal-dashboard-art personal-dashboard-art-cards",
    width: 1024,
    height: 529,
  },
  {
    src: "/illustrated/backgrounds/dashboard-globe.png",
    className: "personal-dashboard-art personal-dashboard-art-globe",
    width: 1024,
    height: 505,
  },
] as const;

export function PersonalDashboardBackground() {
  const appearance = useIllustratedAppearance();
  const rotating = appearance.effectiveIllustratedDesign && appearance.backgroundChangeEnabled;
  const startedAt = useEffectiveRotationStart(
    appearance.backgroundRotationStartedAt,
    rotating,
  );
  const now = useBackgroundRotationNow(
    rotating,
    appearance.backgroundChangeHours,
    startedAt,
  );
  if (!appearance.effectiveIllustratedDesign) return null;

  const step = backgroundSceneStep({
    nowMs: now,
    startedAtMs: startedAt ? Date.parse(startedAt) : null,
    hours: appearance.backgroundChangeHours,
    enabled: rotating,
  });
  const scene =
    step > 0
      ? rotateIllustratedPageTheme(illustratedThemeForSubject("general"), step)
      : null;
  const art = scene
    ? [
        {
          src: scene.left ?? DASHBOARD_ART[0].src,
          className: DASHBOARD_ART[0].className,
          width: scene.leftWidth,
          height: scene.leftHeight,
        },
        DASHBOARD_ART[1],
        {
          src: scene.right ?? DASHBOARD_ART[2].src,
          className: DASHBOARD_ART[2].className,
          width: scene.rightWidth,
          height: scene.rightHeight,
        },
      ]
    : DASHBOARD_ART;

  return (
    <div className="personal-dashboard-bg" aria-hidden>
      {art.map((item) => (
        <Image
          key={item.className}
          src={item.src}
          alt=""
          width={item.width}
          height={item.height}
          unoptimized
          className={item.className}
        />
      ))}
    </div>
  );
}
