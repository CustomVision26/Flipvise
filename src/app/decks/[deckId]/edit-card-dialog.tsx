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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  generateMultipleChoiceAction,
  updateCardAction,
  updateMultipleChoiceCardAction,
  uploadCardImageAction,
} from "@/actions/cards";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  RefreshCw,
  X,
} from "lucide-react";

interface EditCardDialogProps {
  card: {
    id: number;
    front: string | null;
    frontImageUrl?: string | null;
    back: string | null;
    backImageUrl?: string | null;
    cardType: "standard" | "multiple_choice";
    choices: string[] | null;
    correctChoiceIndex: number | null;
  };
  deckId: number;
  hasAI?: boolean;
}

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
        <div className="relative w-full h-32 sm:h-48 rounded-lg overflow-hidden border border-border bg-muted/30">
          <Image
            src={imagePreview}
            alt={altText}
            fill
            className="object-contain"
            unoptimized={imagePreview.startsWith("blob:")}
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs sm:text-sm text-muted-foreground">
              Uploading…
            </div>
          )}
          {!isUploading && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 sm:h-7 sm:w-7"
              onClick={onRemove}
            >
              <X className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit gap-2 text-xs sm:text-sm h-8 sm:h-9"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
        >
          <ImagePlus className="h-3 w-3 sm:h-4 sm:w-4" />
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

function StandardEditForm({
  card,
  deckId,
  onClose,
}: {
  card: EditCardDialogProps["card"];
  deckId: number;
  onClose: () => void;
}) {
  const [front, setFront] = useState(card.front ?? "");
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(card.frontImageUrl ?? null);
  const [frontImagePreview, setFrontImagePreview] = useState<string | null>(
    card.frontImageUrl ?? null,
  );
  const [isUploadingFront, setIsUploadingFront] = useState(false);
  const [back, setBack] = useState(card.back ?? "");
  const [backImageUrl, setBackImageUrl] = useState<string | null>(card.backImageUrl ?? null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(
    card.backImageUrl ?? null,
  );
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  const isUploading = isUploadingFront || isUploadingBack;
  const isBusy = isPending || isUploading;
  const frontHasContent = front.trim().length > 0 || !!frontImageUrl;
  const backHasContent = back.trim().length > 0 || !!backImageUrl;

  async function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (u: string | null) => void,
    setPreview: (u: string | null) => void,
    setIsUploading: (b: boolean) => void,
    fileRef: React.RefObject<HTMLInputElement | null>,
    fallback: string | null,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError(null);
    setIsUploading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadCardImageAction({ deckId }, formData);
      setUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
      setPreview(fallback);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await updateCardAction({
          cardId: card.id,
          deckId,
          front,
          frontImageUrl,
          back,
          backImageUrl,
          oldFrontImageUrl: card.frontImageUrl ?? null,
          oldBackImageUrl: card.backImageUrl ?? null,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 py-2">
      {/* Front */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Front
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`front-${card.id}`} className="text-xs sm:text-sm">
            Text <span className="text-muted-foreground font-normal">(question, term, etc.)</span>
          </Label>
          <Textarea
            id={`front-${card.id}`}
            placeholder="Question or term… (optional if image added)"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={3}
            disabled={isBusy}
            className="text-sm"
          />
        </div>
        <ImageUploadSection
          label="Image (optional)"
          imagePreview={frontImagePreview}
          isUploading={isUploadingFront}
          isBusy={isBusy}
          fileInputRef={frontFileInputRef}
          onFileChange={(e) =>
            handleImageChange(
              e,
              setFrontImageUrl,
              setFrontImagePreview,
              setIsUploadingFront,
              frontFileInputRef,
              card.frontImageUrl ?? null,
            )
          }
          onRemove={() => {
            setFrontImageUrl(null);
            setFrontImagePreview(null);
            if (frontFileInputRef.current) frontFileInputRef.current.value = "";
          }}
          altText="Front image preview"
        />
      </div>

      {/* Back */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Back
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`back-${card.id}`} className="text-xs sm:text-sm">
            Text{" "}
            <span className="text-muted-foreground font-normal">
              (answer, definition, etc.)
            </span>
          </Label>
          <Textarea
            id={`back-${card.id}`}
            placeholder="Answer or definition… (optional if image added)"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={3}
            disabled={isBusy}
            className="text-sm"
          />
        </div>
        <ImageUploadSection
          label="Image (optional)"
          imagePreview={backImagePreview}
          isUploading={isUploadingBack}
          isBusy={isBusy}
          fileInputRef={backFileInputRef}
          onFileChange={(e) =>
            handleImageChange(
              e,
              setBackImageUrl,
              setBackImagePreview,
              setIsUploadingBack,
              backFileInputRef,
              card.backImageUrl ?? null,
            )
          }
          onRemove={() => {
            setBackImageUrl(null);
            setBackImagePreview(null);
            if (backFileInputRef.current) backFileInputRef.current.value = "";
          }}
          altText="Back image preview"
        />
      </div>

      {error && <p className="text-destructive text-xs sm:text-sm">{error}</p>}

      <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isBusy}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isBusy || !frontHasContent || !backHasContent}
          className="w-full sm:w-auto"
        >
          {isPending ? "Saving…" : isUploading ? "Uploading…" : "Save changes"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function MultipleChoiceEditForm({
  card,
  deckId,
  hasAI,
  onClose,
}: {
  card: EditCardDialogProps["card"];
  deckId: number;
  hasAI: boolean;
  onClose: () => void;
}) {
  const existingChoices = card.choices ?? ["", "", "", ""];
  const correctIdx = card.correctChoiceIndex ?? 0;
  const initialCorrect = existingChoices[correctIdx] ?? "";
  const initialDistractors = existingChoices
    .filter((_, i) => i !== correctIdx)
    .slice(0, 3);
  while (initialDistractors.length < 3) initialDistractors.push("");

  const [question, setQuestion] = useState(card.front ?? "");
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(
    card.frontImageUrl ?? null,
  );
  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(
    card.frontImageUrl ?? null,
  );
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState(initialCorrect);
  const [distractors, setDistractors] = useState<string[]>(initialDistractors);
  const [showDistractors, setShowDistractors] = useState(true);
  const [isRegeneratingDistractors, setIsRegeneratingDistractors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isPending || isUploadingImage || isRegeneratingDistractors;
  const questionHasContent = question.trim().length > 0 || !!questionImageUrl;
  const correctFilled = correctAnswer.trim().length > 0;
  const allDistractorsFilled = distractors.every((d) => d.trim().length > 0);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
      return;
    }
    setError(null);
    setIsUploadingImage(true);
    setQuestionImagePreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadCardImageAction({ deckId }, formData);
      setQuestionImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
      setQuestionImagePreview(card.frontImageUrl ?? null);
    } finally {
      setIsUploadingImage(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  }

  function setDistractorAt(i: number, value: string) {
    setDistractors((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  async function handleRegenerateDistractors() {
    if (!question.trim()) {
      setError("Please enter a question first.");
      return;
    }
    if (!correctFilled) {
      setError("Please enter a correct answer first.");
      return;
    }
    setError(null);
    setIsRegeneratingDistractors(true);
    try {
      const result = await generateMultipleChoiceAction({
        deckId,
        question: question.trim(),
        correctAnswer: correctAnswer.trim(),
      });
      setDistractors([...result.distractors]);
      setShowDistractors(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate wrong answers.",
      );
    } finally {
      setIsRegeneratingDistractors(false);
    }
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMultipleChoiceCardAction({
          cardId: card.id,
          deckId,
          question,
          questionImageUrl,
          oldQuestionImageUrl: card.frontImageUrl ?? null,
          correctAnswer,
          distractors,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 py-2">
      {/* Question */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Question
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`mc-question-${card.id}`} className="text-xs sm:text-sm">
            Text
          </Label>
          <Textarea
            id={`mc-question-${card.id}`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            disabled={isBusy}
            className="text-sm"
          />
        </div>
        <ImageUploadSection
          label="Image (optional)"
          imagePreview={questionImagePreview}
          isUploading={isUploadingImage}
          isBusy={isBusy}
          fileInputRef={imageFileInputRef}
          onFileChange={handleImageChange}
          onRemove={() => {
            setQuestionImageUrl(null);
            setQuestionImagePreview(null);
            if (imageFileInputRef.current) imageFileInputRef.current.value = "";
          }}
          altText="Question image preview"
        />
      </div>

      {/* Answers */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Answers
        </p>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor={`mc-correct-${card.id}`}
            className="text-xs sm:text-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Correct answer
          </Label>
          <Input
            id={`mc-correct-${card.id}`}
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            disabled={isBusy}
            className="text-sm border-emerald-500/40 focus-visible:ring-emerald-500/30"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 -ml-2 px-2 gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowDistractors((v) => !v)}
              aria-expanded={showDistractors}
              aria-controls={`mc-distractors-${card.id}`}
            >
              {showDistractors ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Wrong answers (3 required)
            </Button>
            {hasAI && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleRegenerateDistractors}
                      disabled={!question.trim() || !correctFilled || isBusy}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${
                          isRegeneratingDistractors ? "animate-spin" : ""
                        }`}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-center">
                    {!question.trim()
                      ? "Enter a question first"
                      : !correctFilled
                        ? "Enter a correct answer first"
                        : "Regenerate 3 new wrong answers with AI"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {showDistractors && (
            <div id={`mc-distractors-${card.id}`} className="flex flex-col gap-2">
              {distractors.map((d, i) => (
                <Input
                  key={i}
                  value={d}
                  onChange={(e) => setDistractorAt(i, e.target.value)}
                  disabled={isBusy}
                  placeholder={`Wrong answer ${i + 1}`}
                  className="text-sm"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-destructive text-xs sm:text-sm">{error}</p>}

      <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isBusy}
          className="w-full sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isBusy || !questionHasContent || !correctFilled || !allDistractorsFilled}
          className="w-full sm:w-auto"
        >
          {isPending
            ? "Saving…"
            : isUploadingImage
              ? "Uploading…"
              : isRegeneratingDistractors
                ? "Generating…"
                : "Save changes"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function EditCardDialog({ card, deckId, hasAI = false }: EditCardDialogProps) {
  const [open, setOpen] = useState(false);
  const isMC = card.cardType === "multiple_choice";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
          />
        }
      >
        Edit
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">
            {isMC ? "Edit multiple-choice card" : "Edit card"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isMC
              ? "Update the question, the correct answer, and the 3 wrong answers."
              : "Each side can have text, an image, or both — at least one is required per side."}
          </DialogDescription>
        </DialogHeader>

        {isMC ? (
          <MultipleChoiceEditForm
            card={card}
            deckId={deckId}
            hasAI={hasAI}
            onClose={() => setOpen(false)}
          />
        ) : (
          <StandardEditForm card={card} deckId={deckId} onClose={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
