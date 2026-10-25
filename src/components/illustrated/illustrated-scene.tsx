"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { SubjectKey } from "@/lib/illustrated-appearance";
import {
  selectIllustratedAsset,
  type IllustratedAssetRole,
  type IllustratedProp,
} from "@/lib/illustrated-asset-manifest";

export function IllustratedScene({
  subject,
  text,
  variantIndex,
  role = "hero",
  prop,
  fit,
  displayWidth,
  displayHeight,
  className,
}: {
  subject?: SubjectKey | null;
  text?: string | null;
  variantIndex?: number | null;
  role?: IllustratedAssetRole;
  prop?: IllustratedProp | null;
  fit?: "cover" | "contain";
  displayWidth: number;
  displayHeight: number;
  className?: string;
}) {
  const choice = selectIllustratedAsset({
    role: prop ? "prop" : role,
    subject,
    text,
    variantIndex,
    prop,
    displayWidth,
    displayHeight,
    devicePixelRatio: 2,
  });
  if (!choice.asset) {
    return (
      <div
        role="status"
        className="flex h-full w-full items-center justify-center bg-[#f6f1e8] p-3 text-center text-xs font-medium text-slate-700"
      >
        {choice.missingPath
          ? `Artwork missing: ${choice.missingPath}`
          : "Artwork missing"}
      </div>
    );
  }
  const asset = choice.asset;
  const objectFit = (fit ?? asset.fit) === "cover" ? "cover" : "contain";
  return (
    <Image
      src={asset.path}
      alt=""
      fill
      sizes="(max-width: 768px) 100vw, 640px"
      className={cn(objectFit === "cover" ? "object-cover" : "object-contain", className)}
      style={{ width: "100%", height: "100%", objectFit }}
    />
  );
}
