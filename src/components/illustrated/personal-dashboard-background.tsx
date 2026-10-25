"use client";

import Image from "next/image";
import { useIllustratedAppearance } from "@/components/illustrated-appearance-provider";

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
  const { effectiveIllustratedDesign } = useIllustratedAppearance();
  if (!effectiveIllustratedDesign) return null;

  return (
    <div className="personal-dashboard-bg" aria-hidden>
      {DASHBOARD_ART.map((art) => (
        <Image
          key={art.src}
          src={art.src}
          alt=""
          width={art.width}
          height={art.height}
          className={art.className}
        />
      ))}
    </div>
  );
}
