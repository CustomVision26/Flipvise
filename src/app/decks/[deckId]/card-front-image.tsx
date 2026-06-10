"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageEnlargeOverlay } from "@/components/image-enlarge-overlay";
import { cn } from "@/lib/utils";
import { useCardHoverPreview } from "./card-hover-preview-context";

type CardFrontImageProps = {
  src: string;
  alt: string;
  label?: string;
  /** Compact grid tile vs small thumbnail in detailed grid row */
  variant?: "tile" | "thumb";
  className?: string;
};

export function CardFrontImage({
  src,
  alt,
  label,
  variant = "tile",
  className,
}: CardFrontImageProps) {
  const [open, setOpen] = useState(false);
  const hoverPreview = useCardHoverPreview();

  return (
    <>
      <button
        type="button"
        className={cn(
          "relative shrink-0 overflow-hidden border border-border bg-muted/30 cursor-zoom-in",
          "transition-[box-shadow,transform] hover:ring-2 hover:ring-primary/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "tile" && "aspect-[2/1] w-full rounded-sm",
          variant === "thumb" && "h-14 w-14 rounded-sm sm:h-16 sm:w-16",
          className,
        )}
        title="Double-click to enlarge"
        aria-label={`Double-click to enlarge ${alt}`}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          hoverPreview?.closeHover();
          setOpen(true);
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain pointer-events-none"
          sizes={variant === "tile" ? "120px" : "64px"}
          draggable={false}
        />
      </button>

      <ImageEnlargeOverlay
        open={open}
        onClose={() => setOpen(false)}
        src={src}
        alt={alt}
        title={label ?? "Front image"}
      />
    </>
  );
}
