"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
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
  return (
    <div className={cn("flex shrink-0 flex-col items-center", className)}>
      {imagePreview ? (
        <div className="relative h-9 w-9 overflow-hidden rounded-md border border-border bg-muted/30 sm:h-10 sm:w-10">
          <Image
            src={imagePreview}
            alt={altText}
            fill
            className="object-cover"
            unoptimized={imagePreview.startsWith("blob:") || imagePreview.startsWith("data:")}
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
              onClick={onRemove}
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
