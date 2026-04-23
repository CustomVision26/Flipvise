"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Mic, MicOff, ImagePlus, X, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  updateDeckAction,
  uploadDeckCoverImageAction,
  removeDeckCoverImageAction,
} from "@/actions/decks";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Invalid file type. Only JPG, JPEG, PNG, WebP, and GIF images are allowed.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Image size must be 5MB or less.";
  }
  return null;
}

interface EditDeckDialogProps {
  deck: {
    id: number;
    name: string;
    description: string | null;
    teamId: number | null;
    coverImageUrl?: string | null;
  };
}

export function EditDeckDialog({ deck }: EditDeckDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description ?? "");
  const [coverUrl, setCoverUrl] = useState(deck.coverImageUrl ?? null);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const coverFileRef = useRef<HTMLInputElement>(null);

  const showTeamDeckCover = deck.teamId !== null;

  const nameSpeech = useSpeechRecognition((t) =>
    setName((prev) => (prev ? prev + " " + t.trim() : t.trim())),
  );
  const descriptionSpeech = useSpeechRecognition((t) =>
    setDescription((prev) => (prev ? prev + " " + t.trim() : t.trim())),
  );

  const speechError = nameSpeech.error ?? descriptionSpeech.error;

  useEffect(() => {
    if (open) {
      setCoverUrl(deck.coverImageUrl ?? null);
    }
  }, [open, deck.coverImageUrl]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      nameSpeech.stop();
      descriptionSpeech.stop();
      nameSpeech.clearError();
      descriptionSpeech.clearError();
      setName(deck.name);
      setDescription(deck.description ?? "");
      setCoverUploadError(null);
      setError(null);
    }
    setOpen(next);
  }

  async function handleCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (coverFileRef.current) coverFileRef.current.value = "";
    if (!file || !showTeamDeckCover) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setCoverUploadError(validationError);
      return;
    }

    setCoverUploadError(null);
    setCoverUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { url } = await uploadDeckCoverImageAction({ deckId: deck.id }, formData);
      setCoverUrl(url);
      router.refresh();
    } catch (err) {
      setCoverUploadError(
        err instanceof Error ? err.message : "Image upload failed.",
      );
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleRemoveCover() {
    if (!coverUrl || !showTeamDeckCover) return;
    setCoverUploadError(null);
    setCoverUploading(true);
    try {
      await removeDeckCoverImageAction({ deckId: deck.id });
      setCoverUrl(null);
      router.refresh();
    } catch (err) {
      setCoverUploadError(
        err instanceof Error ? err.message : "Could not remove cover image.",
      );
    } finally {
      setCoverUploading(false);
    }
  }

  function handleSubmit() {
    setError(null);
    nameSpeech.stop();
    descriptionSpeech.stop();
    startTransition(async () => {
      try {
        await updateDeckAction({
          deckId: deck.id,
          name,
          description: description.trim() || undefined,
        });
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4" />}>
        Edit Deck
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.25rem)] max-w-md max-h-[min(92dvh,40rem)] overflow-y-auto overflow-x-hidden p-4 sm:p-6 sm:mx-auto sm:w-full">
        <DialogHeader className="text-left sm:text-left">
          <DialogTitle className="text-base leading-snug sm:text-lg sm:text-xl">
            Edit deck
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed sm:text-sm">
            Update the name and description of this deck.
            {showTeamDeckCover
              ? " Team decks can use an optional cover image on dashboard deck cards."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1 sm:gap-4 sm:py-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="deck-name" className="text-xs sm:text-sm">Name</Label>
              {nameSpeech.supported && (
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button
                      type="button"
                      variant={nameSpeech.isRecording ? "destructive" : "outline"}
                      size="icon"
                      className="h-7 w-7"
                      aria-label={
                        nameSpeech.isRecording
                          ? "Stop recording name"
                          : "Dictate name with microphone"
                      }
                      onClick={() =>
                        nameSpeech.isRecording ? nameSpeech.stop() : nameSpeech.start()
                      }
                      disabled={isPending || descriptionSpeech.isRecording}
                    >
                      {nameSpeech.isRecording ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-center">
                    {nameSpeech.isRecording
                      ? "Click to stop recording. Your speech is being added to the name field."
                      : "Click to dictate. Allow microphone access when prompted, then speak clearly — your words will be transcribed into the name field. Click again to stop."}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Input
              id="deck-name"
              placeholder="Deck name…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="deck-description" className="text-xs sm:text-sm">Description</Label>
              {descriptionSpeech.supported && (
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button
                      type="button"
                      variant={descriptionSpeech.isRecording ? "destructive" : "outline"}
                      size="icon"
                      className="h-7 w-7"
                      aria-label={
                        descriptionSpeech.isRecording
                          ? "Stop recording description"
                          : "Dictate description with microphone"
                      }
                      onClick={() =>
                        descriptionSpeech.isRecording
                          ? descriptionSpeech.stop()
                          : descriptionSpeech.start()
                      }
                      disabled={isPending || nameSpeech.isRecording}
                    >
                      {descriptionSpeech.isRecording ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-center">
                    {descriptionSpeech.isRecording
                      ? "Click to stop recording. Your speech is being added to the description field."
                      : "Click to dictate. Allow microphone access when prompted, then speak clearly — your words will be transcribed into the description field. Click again to stop."}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Textarea
              id="deck-description"
              placeholder="Optional description…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isPending}
              className="text-sm"
            />
          </div>

          {showTeamDeckCover && (
            <div className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 p-2.5 sm:p-3">
              <Label
                htmlFor="deck-cover-image"
                className="flex items-start gap-2 text-xs font-medium sm:items-center sm:text-sm"
              >
                <ImagePlus className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" aria-hidden />
                <span className="leading-snug">Cover image (optional)</span>
              </Label>
              <Input
                ref={coverFileRef}
                id="deck-cover-image"
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                onChange={handleCoverFileChange}
                disabled={isPending || coverUploading}
                className="h-auto min-h-8 cursor-pointer bg-background py-1.5 text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-[11px] file:font-medium file:text-foreground sm:file:text-xs"
              />
              {coverUrl ? (
                <div className="relative space-y-2">
                  <div className="relative mx-auto aspect-[5/2] w-full max-h-[7.5rem] overflow-hidden rounded-md border border-border bg-muted/30 sm:aspect-[2/1] sm:max-h-[10rem]">
                    <Image
                      src={coverUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 400px) 92vw, 448px"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full gap-1.5 sm:h-9 sm:w-auto"
                    onClick={handleRemoveCover}
                    disabled={isPending || coverUploading}
                  >
                    <X className="size-3.5" aria-hidden />
                    Remove cover
                  </Button>
                </div>
              ) : null}
              {coverUploading && (
                <div className="flex items-center gap-2 text-muted-foreground text-[11px] sm:text-xs">
                  <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
                  Updating cover…
                </div>
              )}
              {coverUploadError && (
                <p className="text-destructive text-[11px] leading-snug sm:text-xs">{coverUploadError}</p>
              )}
            </div>
          )}

          {!nameSpeech.supported && !descriptionSpeech.supported && (
            <p className="text-muted-foreground text-[11px] sm:text-xs">
              Voice dictation isn&apos;t supported in this browser. Try Chrome, Edge, or Safari.
            </p>
          )}

          {speechError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive whitespace-pre-line">
              {speechError}
            </div>
          )}

          {error && <p className="text-destructive text-xs sm:text-sm">{error}</p>}
        </div>

        <DialogFooter className="mt-1 gap-2 sm:mt-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
            className="h-10 w-full sm:h-8 sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name.trim()}
            className="h-10 w-full sm:h-8 sm:w-auto"
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
