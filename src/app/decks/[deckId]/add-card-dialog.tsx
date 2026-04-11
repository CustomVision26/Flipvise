"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createCardAction, uploadCardImageAction } from "@/actions/cards";
import { ImagePlus, X } from "lucide-react";

interface AddCardDialogProps {
  deckId: number;
  trigger?: React.ReactElement;
  isAtLimit?: boolean;
}

function ImageUploadSection({
  label,
  imagePreview,
  isUploading,
  isBusy,
  fileInputRef,
  onFileChange,
  onRemove,
  altText,
}: {
  label: string;
  imagePreview: string | null;
  isUploading: boolean;
  isBusy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  altText: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {imagePreview ? (
        <div className="relative w-full rounded-lg overflow-hidden border border-border">
          <Image
            src={imagePreview}
            alt={altText}
            width={400}
            height={200}
            className="w-full object-cover max-h-40"
            unoptimized={imagePreview.startsWith("blob:")}
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
              Uploading…
            </div>
          )}
          {!isUploading && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7"
              onClick={onRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
        >
          <ImagePlus className="h-4 w-4" />
          Add image
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

export function AddCardDialog({ deckId, trigger, isAtLimit = false }: AddCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState("");
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [frontImagePreview, setFrontImagePreview] = useState<string | null>(null);
  const [isUploadingFront, setIsUploadingFront] = useState(false);
  const [back, setBack] = useState("");
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  if (isAtLimit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} />}>
            <Button variant="outline" size="sm" disabled>
              + Add Card
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Card limit reached. Upgrade to Pro for unlimited cards.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFront("");
      setFrontImageUrl(null);
      setFrontImagePreview(null);
      setBack("");
      setBackImageUrl(null);
      setBackImagePreview(null);
      setError(null);
    }
    setOpen(next);
  }

  async function handleFrontImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploadingFront(true);
    setFrontImagePreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadCardImageAction({ deckId }, formData);
      setFrontImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Front image upload failed.");
      setFrontImagePreview(null);
    } finally {
      setIsUploadingFront(false);
      if (frontFileInputRef.current) frontFileInputRef.current.value = "";
    }
  }

  function handleRemoveFrontImage() {
    setFrontImageUrl(null);
    setFrontImagePreview(null);
    if (frontFileInputRef.current) frontFileInputRef.current.value = "";
  }

  async function handleBackImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsUploadingBack(true);
    setBackImagePreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadCardImageAction({ deckId }, formData);
      setBackImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Back image upload failed.");
      setBackImagePreview(null);
    } finally {
      setIsUploadingBack(false);
      if (backFileInputRef.current) backFileInputRef.current.value = "";
    }
  }

  function handleRemoveBackImage() {
    setBackImageUrl(null);
    setBackImagePreview(null);
    if (backFileInputRef.current) backFileInputRef.current.value = "";
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await createCardAction({ deckId, front, frontImageUrl, back, backImageUrl });
        setOpen(false);
        setFront("");
        setFrontImageUrl(null);
        setFrontImagePreview(null);
        setBack("");
        setBackImageUrl(null);
        setBackImagePreview(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const isUploading = isUploadingFront || isUploadingBack;
  const isBusy = isPending || isUploading;
  const frontHasContent = front.trim().length > 0 || !!frontImageUrl;
  const backHasContent = back.trim().length > 0 || !!backImageUrl;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== undefined ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger render={<Button variant="outline" />}>
          + Add Card
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a new card</DialogTitle>
          <DialogDescription>
            Each side can have text, an image, or both — at least one is required per side.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Front */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Front
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="front">Text <span className="text-muted-foreground font-normal">(question, term, etc.)</span></Label>
              <Textarea
                id="front"
                placeholder="Question or term… (optional if image added)"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                rows={3}
                disabled={isBusy}
              />
            </div>
            <ImageUploadSection
              label="Image (optional)"
              imagePreview={frontImagePreview}
              isUploading={isUploadingFront}
              isBusy={isBusy}
              fileInputRef={frontFileInputRef}
              onFileChange={handleFrontImageChange}
              onRemove={handleRemoveFrontImage}
              altText="Front image preview"
            />
          </div>

          {/* Back */}
          <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Back
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="back">Text <span className="text-muted-foreground font-normal">(answer, definition, etc.)</span></Label>
              <Textarea
                id="back"
                placeholder="Answer or definition… (optional if image added)"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                rows={3}
                disabled={isBusy}
              />
            </div>
            <ImageUploadSection
              label="Image (optional)"
              imagePreview={backImagePreview}
              isUploading={isUploadingBack}
              isBusy={isBusy}
              fileInputRef={backFileInputRef}
              onFileChange={handleBackImageChange}
              onRemove={handleRemoveBackImage}
              altText="Back image preview"
            />
          </div>

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isBusy || !frontHasContent || !backHasContent}
          >
            {isPending ? "Adding…" : isUploading ? "Uploading…" : "Add Card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
