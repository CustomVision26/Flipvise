"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

  return (
    <>
      <button
        type="button"
        className={cn(
          "relative shrink-0 overflow-hidden border border-border bg-muted/30 cursor-zoom-in",
          "transition-[box-shadow,transform] hover:ring-2 hover:ring-primary/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          variant === "tile" && "aspect-[16/10] w-full rounded-sm",
          variant === "thumb" && "h-14 w-14 rounded-sm sm:h-16 sm:w-16",
          className,
        )}
        title="Double-click to enlarge"
        aria-label={`Double-click to enlarge ${alt}`}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain pointer-events-none"
          sizes={variant === "tile" ? "160px" : "64px"}
          draggable={false}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-max max-w-[min(calc(100vw-2rem),28rem)] gap-0 overflow-hidden border-2 border-primary bg-card p-0 shadow-lg shadow-primary/30 ring-0 sm:max-w-[min(calc(100vw-2rem),28rem)]">
          <DialogHeader className="gap-0 border-b border-primary/40 bg-primary px-3 py-2 pr-10 text-left">
            <DialogTitle className="text-xs font-semibold text-primary-foreground">
              {label ?? "Front image"}
            </DialogTitle>
            <DialogDescription className="sr-only">Enlarged front image</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 bg-card p-3">
            <Image
              src={src}
              alt={alt}
              width={640}
              height={480}
              className="mx-auto block h-auto max-h-[min(60vh,22rem)] w-auto max-w-[min(calc(100vw-3.5rem),26rem)] rounded-md border border-primary/35 bg-muted object-contain"
              priority
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
