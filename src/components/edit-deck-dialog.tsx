"use client";

import {
  useState,
  useTransition,
  useRef,
  useEffect,
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Mic, MicOff, ImagePlus, X, Loader2, HelpCircle } from "lucide-react";
import { GradientPicker } from "@/components/gradient-picker";
import {
  TeacherNameFieldHelpContent,
  TeacherTopicFieldHelpContent,
} from "@/components/teacher-field-help-content";
import type { GradientSlug } from "@/lib/deck-gradients";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  updateDeckAction,
  uploadDeckCoverImageAction,
  removeDeckCoverImageAction,
} from "@/actions/decks";
import {
  clearDeckFirstCardFrontImageAction,
  getDeckFirstCardFrontStateAction,
  setDeckFirstCardFrontImageAction,
} from "@/actions/cards";
import { LESSON_DIFFICULTY_LEVELS } from "@/lib/lesson-plan-difficulty";
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
    gradeLevel?: string | null;
    difficultyLevel?: string | null;
    teamId?: number | null;
    coverImageUrl?: string | null;
    gradient?: string | null;
  };
  /** Team-tier subscriber decks (scoped or migrated) may upload covers. */
  allowCoverUpload: boolean;
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
  triggerClassName?: string;
  triggerIcon?: ReactNode;
  /** Controlled open state — use with `hideTrigger` when opening from another menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function EditDeckDialog({
  deck,
  allowCoverUpload,
  triggerLabel = "Edit deck",
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName = "h-9 gap-2",
  triggerIcon,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: EditDeckDialogProps) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const [name, setName] = useState(deck.name);
  const [description, setDescription] = useState(deck.description ?? "");
  const [gradeLevel, setGradeLevel] = useState(deck.gradeLevel ?? "");
  const [difficultyLevel, setDifficultyLevel] = useState(deck.difficultyLevel ?? "");
  const [gradient, setGradient] = useState<GradientSlug>((deck.gradient as GradientSlug) ?? "none");
  const [coverUrl, setCoverUrl] = useState(deck.coverImageUrl ?? null);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [firstCardFrontUrl, setFirstCardFrontUrl] = useState<string | null>(null);
  const [firstCardFrontError, setFirstCardFrontError] = useState<string | null>(null);
  const [firstCardFrontUploading, setFirstCardFrontUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const coverFileRef = useRef<HTMLInputElement>(null);
  const firstCardFrontFileRef = useRef<HTMLInputElement>(null);

  const showTeamDeckCover = allowCoverUpload;

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
      setFirstCardFrontError(null);
      let cancelled = false;
      void getDeckFirstCardFrontStateAction({ deckId: deck.id })
        .then((state) => {
          if (!cancelled) setFirstCardFrontUrl(state.frontImageUrl);
        })
        .catch(() => {
          if (!cancelled) setFirstCardFrontUrl(null);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [open, deck.coverImageUrl, deck.id]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      nameSpeech.stop();
      descriptionSpeech.stop();
      nameSpeech.clearError();
      descriptionSpeech.clearError();
      setName(deck.name);
      setDescription(deck.description ?? "");
      setGradeLevel(deck.gradeLevel ?? "");
      setDifficultyLevel(deck.difficultyLevel ?? "");
      setGradient((deck.gradient as GradientSlug) ?? "none");
      setCoverUploadError(null);
      setFirstCardFrontError(null);
      setError(null);
    }
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
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

  async function handleFirstCardFrontFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (firstCardFrontFileRef.current) firstCardFrontFileRef.current.value = "";
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setFirstCardFrontError(validationError);
      return;
    }

    setFirstCardFrontError(null);
    setFirstCardFrontUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const state = await setDeckFirstCardFrontImageAction(
        { deckId: deck.id },
        formData,
      );
      setFirstCardFrontUrl(state.frontImageUrl);
      router.refresh();
    } catch (err) {
      setFirstCardFrontError(
        err instanceof Error ? err.message : "Image upload failed.",
      );
    } finally {
      setFirstCardFrontUploading(false);
    }
  }

  async function handleRemoveFirstCardFront() {
    if (!firstCardFrontUrl) return;
    setFirstCardFrontError(null);
    setFirstCardFrontUploading(true);
    try {
      const state = await clearDeckFirstCardFrontImageAction({ deckId: deck.id });
      setFirstCardFrontUrl(state.frontImageUrl);
      router.refresh();
    } catch (err) {
      setFirstCardFrontError(
        err instanceof Error ? err.message : "Could not remove front image.",
      );
    } finally {
      setFirstCardFrontUploading(false);
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
          gradeLevel: gradeLevel.trim() || undefined,
          difficultyLevel: difficultyLevel.trim() || undefined,
          gradient: gradient !== "none" ? gradient : undefined,
        });
        handleOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger ? (
        <DialogTrigger
          render={
            <Button
              variant={triggerVariant}
              size={triggerSize}
              className={triggerClassName}
            />
          }
        >
          {triggerIcon}
          {triggerLabel}
        </DialogTrigger>
      ) : null}
      <DialogContent className="w-[calc(100vw-1.25rem)] max-w-md max-h-[min(92dvh,40rem)] overflow-y-auto overflow-x-hidden p-4 sm:p-6 sm:mx-auto sm:w-full">
        <DialogHeader className="text-left sm:text-left">
          <DialogTitle className="text-base leading-snug sm:text-lg sm:text-xl">
            Edit deck
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed sm:text-sm">
            Update the name/subject/course, description/topic, grade level, difficulty, and
            optional first card front image for this deck.
            {showTeamDeckCover
              ? " Team decks can use an optional cover image on dashboard deck cards."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
        <div className="flex flex-col gap-3 py-1 sm:gap-4 sm:py-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deck-name" className="text-xs sm:text-sm">
                  Name/Subject/Course
                </Label>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Examples for name, subject, or course"
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <TeacherNameFieldHelpContent />
                  </TooltipContent>
                </Tooltip>
              </div>
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
              placeholder="e.g. Jamaican History"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deck-description" className="text-xs sm:text-sm">
                  Description/Topic
                </Label>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Examples for description or topic"
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <TeacherTopicFieldHelpContent />
                  </TooltipContent>
                </Tooltip>
              </div>
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
              placeholder="e.g. Learning Jamaica's independence and national identity"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isPending}
              className="text-sm"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deck-grade-level" className="text-xs sm:text-sm">
                  Grade Level
                </Label>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Examples for grade level"
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                    <p className="mb-1 font-semibold">Examples by level:</p>
                    <ul className="list-disc space-y-0.5 pl-4">
                      <li>Primary: Grade 1–6</li>
                      <li>Secondary: Grade 7–11</li>
                      <li>Tertiary: Year 1, Year 2, 1st Year College, Undergraduate</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="deck-grade-level"
                placeholder="e.g. Grade 6"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                disabled={isPending}
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deck-difficulty-level" className="text-xs sm:text-sm">
                  Difficulty Level
                </Label>
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Examples for difficulty level"
                  >
                    <HelpCircle className="h-4 w-4" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs text-xs leading-relaxed">
                    <p className="mb-1 font-semibold">Choose the class readiness level:</p>
                    <p>
                      Beginner for foundational support; Intermediate for most classes;
                      Advanced for accelerated learners; Honors/Gifted for enrichment groups.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={difficultyLevel}
                onValueChange={(value) => {
                  if (value == null) return;
                  setDifficultyLevel(value);
                }}
              >
                <SelectTrigger
                  id="deck-difficulty-level"
                  className="h-8 w-full bg-background text-sm sm:h-9"
                >
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_DIFFICULTY_LEVELS.filter((level) => level !== "All").map(
                    (option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label
              htmlFor="deck-first-card-front-image"
              className="flex items-start gap-2 text-xs font-medium sm:items-center sm:text-sm"
            >
              <ImagePlus className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" aria-hidden />
              <span className="leading-snug">First card front image (optional)</span>
            </Label>
            <Input
              ref={firstCardFrontFileRef}
              id="deck-first-card-front-image"
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              onChange={handleFirstCardFrontFileChange}
              disabled={isPending || firstCardFrontUploading}
              className="h-auto min-h-8 cursor-pointer bg-background py-1.5 text-xs text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1.5 file:text-[11px] file:font-medium file:text-foreground sm:file:text-xs"
            />
            {firstCardFrontUrl ? (
              <div className="relative space-y-2">
                <div className="relative mx-auto aspect-[5/2] w-full max-h-[7.5rem] overflow-hidden rounded-md border border-border bg-muted/30 sm:aspect-[2/1] sm:max-h-[10rem]">
                  <Image
                    src={firstCardFrontUrl}
                    alt="First card front preview"
                    fill
                    className="object-contain"
                    sizes="(max-width: 400px) 92vw, 448px"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full gap-1.5 sm:h-9 sm:w-auto"
                  onClick={handleRemoveFirstCardFront}
                  disabled={isPending || firstCardFrontUploading}
                >
                  <X className="size-3.5" aria-hidden />
                  Remove front image
                </Button>
              </div>
            ) : null}
            {firstCardFrontUploading && (
              <div className="flex items-center gap-2 text-muted-foreground text-[11px] sm:text-xs">
                <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
                Updating front image…
              </div>
            )}
            {firstCardFrontError && (
              <p className="text-destructive text-[11px] leading-snug sm:text-xs">
                {firstCardFrontError}
              </p>
            )}
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

          <GradientPicker value={gradient} onChange={setGradient} disabled={isPending} />

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
        </TooltipProvider>

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
