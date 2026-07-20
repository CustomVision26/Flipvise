"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ImageEnlargeOverlay } from "@/components/image-enlarge-overlay";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnswerChoiceImageControl({
  imagePreview,
  isUploading,
  isBusy,
  fileInputRef,
  onFileChange,
  onRemove,
  altText,
  className,
}: {
  imagePreview: string | null;
  isUploading: boolean;
  isBusy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  altText: string;
  className?: string;
}) {
  const [enlargeOpen, setEnlargeOpen] = useState(false);

  useEffect(() => {
    if (!imagePreview) setEnlargeOpen(false);
  }, [imagePreview]);

  return (
    <div className={cn("flex shrink-0 flex-col items-center", className)}>
      {imagePreview ? (
        <div
          className={cn(
            "relative h-9 w-9 overflow-hidden rounded-md border border-border bg-muted/30 sm:h-10 sm:w-10",
            !isUploading && "cursor-zoom-in",
          )}
          title="Double-click to enlarge"
          aria-label={`Double-click to enlarge ${altText}`}
          onDoubleClick={(event) => {
            if (isUploading) return;
            event.preventDefault();
            event.stopPropagation();
            setEnlargeOpen(true);
          }}
        >
          <Image
            src={imagePreview}
            alt={altText}
            fill
            className="object-cover pointer-events-none"
            unoptimized={imagePreview.startsWith("blob:") || imagePreview.startsWith("data:")}
            draggable={false}
          />
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-[10px] text-muted-foreground">
              …
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -right-1 -top-1 h-4 w-4 rounded-full"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              disabled={isBusy}
              aria-label={`Remove ${altText}`}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 sm:h-10 sm:w-10"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          aria-label={`Add ${altText}`}
          title="Add image"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFileChange}
      />

      {imagePreview ? (
        <ImageEnlargeOverlay
          open={enlargeOpen}
          onClose={() => setEnlargeOpen(false)}
          src={imagePreview}
          alt={altText}
          title={altText}
        />
      ) : null}
    </div>
  );
}

export function extractWrongChoiceImages(
  choiceImageUrls: (string | null)[] | null | undefined,
  correctIdx: number,
): [string | null, string | null, string | null] {
  const urls = choiceImageUrls ?? [];
  const wrongIndices = [0, 1, 2, 3].filter((index) => index !== correctIdx).slice(0, 3);
  return [
    urls[wrongIndices[0] ?? 1] ?? null,
    urls[wrongIndices[1] ?? 2] ?? null,
    urls[wrongIndices[2] ?? 3] ?? null,
  ];
}

export function buildChoiceImageTuple(
  correctImage: string | null,
  wrongImages: [string | null, string | null, string | null],
): [string | null, string | null, string | null, string | null] {
  return [correctImage, wrongImages[0], wrongImages[1], wrongImages[2]];
}
