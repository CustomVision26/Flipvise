"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

function isLocalImageSrc(src: string): boolean {
  return src.startsWith("blob:") || src.startsWith("data:");
}

type ImageEnlargeOverlayProps = {
  open: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  title?: string;
  footer?: ReactNode;
};

/** Full-screen enlarged image preview — portals to `document.body` to avoid nested modal issues. */
export function ImageEnlargeOverlay({
  open,
  onClose,
  src,
  alt = "Enlarged image preview",
  title = "Image preview",
  footer,
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 supports-backdrop-filter:backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div
        className="relative flex max-h-[min(92vh,48rem)] max-w-[min(calc(100vw-2rem),56rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5 pr-12">
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>
        <div className="overflow-auto p-4">
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={900}
            className="mx-auto block h-auto max-h-[min(78vh,42rem)] w-auto max-w-full rounded-md border border-border/60 bg-muted object-contain"
            unoptimized={isLocalImageSrc(src)}
            priority
          />
          {footer ? <div className="mt-3">{footer}</div> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2"
          onClick={onClose}
          aria-label="Close enlarged preview"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
