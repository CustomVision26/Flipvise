"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImageEnlargeOverlayProps = {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  title: string;
  footer?: React.ReactNode;
  unoptimized?: boolean;
};

/** Full-screen image preview via portal — avoids nested Dialog portal teardown crashes. */
export function ImageEnlargeOverlay({
  open,
  onClose,
  src,
  alt,
  title,
  footer,
  unoptimized = false,
}: ImageEnlargeOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 supports-backdrop-filter:backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative flex max-h-[min(92vh,40rem)] max-w-[min(calc(100vw-1.5rem),36rem)] flex-col overflow-hidden rounded-xl border-2 border-primary bg-card shadow-lg shadow-primary/30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-primary/40 bg-primary px-3 py-2 pr-10">
          <p className="text-xs font-semibold text-primary-foreground">{title}</p>
        </div>
        <div className="flex flex-col gap-3 overflow-y-auto p-4">
          <Image
            src={src}
            alt={alt}
            width={640}
            height={480}
            className="mx-auto block h-auto max-h-[min(55vh,26rem)] w-auto max-w-[min(calc(100vw-3rem),32rem)] rounded-md border border-primary/35 bg-muted object-contain"
            unoptimized={unoptimized}
            priority
          />
          {footer ? (
            <div className="border-t border-border/60 pt-3 text-base leading-relaxed">
              {footer}
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 text-primary-foreground hover:bg-primary-foreground/20"
          onClick={onClose}
          aria-label="Close enlarged image"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
