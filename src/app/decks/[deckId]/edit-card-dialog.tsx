"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
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
  Popover,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  generateAnswerAction,
  generateMultipleChoiceAction,
  updateCardAction,
  updateMultipleChoiceCardAction,
  uploadCardImageAction,
} from "@/actions/cards";
import {
  ImagePlus,
  Mic,
  MicOff,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageEnlargeOverlay } from "@/components/image-enlarge-overlay";
import { buildMathDiagramPngFile } from "@/lib/math-diagrams/build-diagram-file";
import {
  AiGeneratePopoverContent,
  type AiGenerateMode,
  type AiImageSide,
} from "./ai-generate-popover";
import {
  AnswerChoiceImageControl,
  buildChoiceImageTuple,
  extractWrongChoiceImages,
} from "./answer-choice-image-control";

interface EditCardDialogProps {
  card: {
    id: number;
    front: string | null;
    frontImageUrl?: string | null;
    back: string | null;
    backImageUrl?: string | null;
    cardType: "standard" | "multiple_choice";
    choices: string[] | null;
    choiceImageUrls?: (string | null)[] | null;
    correctChoiceIndex: number | null;
  };
  deckId: number;
  hasAI?: boolean;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function initialCorrectAnswerImage(
  choiceImageUrls: (string | null)[] | null | undefined,
  correctIdx: number,
): string | null {
  const urls = choiceImageUrls ?? [];
  return urls[correctIdx] ?? null;
}

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Invalid file type. Only JPG, JPEG, PNG, WebP, and GIF images are allowed.";
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return "Image size must be 5MB or less.";
  }
  return null;
}

function EditCardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border bg-muted/15 p-3 sm:p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function EditCardTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
  rows = 3,
  actions,
}: {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs sm:text-sm">
          {label ?? "Text"}
        </Label>
        {actions}
      </div>
      <Textarea
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        disabled={disabled}
        className="text-sm bg-background"
      />
    </div>
  );
}

function EditCardDialogFooter({
  onCancel,
  onSave,
  isBusy,
  saveDisabled,
  saveLabel,
}: {
  onCancel: () => void;
  onSave: () => void;
  isBusy: boolean;
  saveDisabled: boolean;
  saveLabel: string;
}) {
  return (
    <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-1">
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={isBusy}
        className="w-full sm:w-auto"
      >
        Cancel
      </Button>
      <Button
        onClick={onSave}
        disabled={isBusy || saveDisabled}
        className="w-full sm:w-auto"
      >
        {saveLabel}
      </Button>
    </DialogFooter>
  );
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
  compact = false,
}: {
  label: string;
  imagePreview: string | null;
  isUploading: boolean;
  isBusy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  altText: string;
  compact?: boolean;
}) {
  const [enlargeOpen, setEnlargeOpen] = useState(false);

  useEffect(() => {
    if (!imagePreview) setEnlargeOpen(false);
  }, [imagePreview]);

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {imagePreview ? (
        <div
          className={cn(
            "relative w-full rounded-lg overflow-hidden border border-border bg-muted/30",
            compact ? "h-24 sm:h-28" : "h-32 sm:h-48",
            !isUploading && "cursor-zoom-in",
          )}
          title="Double-click to enlarge"
          aria-label={`Double-click to enlarge ${altText}`}
          onDoubleClick={(event) => {
            if (isUploading) return;
            event.preventDefault();
            setEnlargeOpen(true);
          }}
        >
          <Image
            src={imagePreview}
            alt={altText}
            fill
            className="object-contain pointer-events-none"
            unoptimized={imagePreview.startsWith("blob:") || imagePreview.startsWith("data:")}
            draggable={false}
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

function extractDistractorsFromChoices(
  choices: string[] | null | undefined,
  correctIdx: number,
): [string, string, string] {
  if (!choices || choices.length < 4) return ["", "", ""];
  const wrong = choices.filter((_, i) => i !== correctIdx).slice(0, 3);
  while (wrong.length < 3) wrong.push("");
  return [wrong[0] ?? "", wrong[1] ?? "", wrong[2] ?? ""];
}

function WrongAnswersSection({
  cardId,
  distractors,
  onDistractorChange,
  wrongImagePreviews,
  uploadingWrongImageIndex,
  wrongImageInputRefs,
  onWrongImageChange,
  onWrongImageRemove,
  disabled,
  hasAI,
  onRegenerate,
  isRegenerating,
  canRegenerate,
}: {
  cardId: number;
  distractors: string[];
  onDistractorChange: (index: number, value: string) => void;
  wrongImagePreviews: (string | null)[];
  uploadingWrongImageIndex: number | null;
  wrongImageInputRefs: React.RefObject<HTMLInputElement | null>[];
  onWrongImageChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onWrongImageRemove: (index: number) => void;
  disabled: boolean;
  hasAI: boolean;
  onRegenerate: () => void;
  isRegenerating: boolean;
  canRegenerate: boolean;
}) {
  return (
    <EditCardSection title="Wrong answers">
      <div className="flex flex-col gap-2">
        {hasAI && (
          <div className="flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={onRegenerate}
                    disabled={!canRegenerate || disabled}
                    aria-label="Regenerate wrong answers with AI"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isRegenerating ? "animate-spin" : ""}`}
                    />
                    Regenerate
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-center">
                  {!canRegenerate
                    ? "Enter front and back text first"
                    : "Regenerate 3 new wrong answers with AI"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        {distractors.map((d, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Label htmlFor={`wrong-answer-${cardId}-${i}`} className="text-xs sm:text-sm">
              Wrong answer {i + 1}
            </Label>
            <div className="flex items-start gap-2">
              <Input
                id={`wrong-answer-${cardId}-${i}`}
                value={d}
                onChange={(e) => onDistractorChange(i, e.target.value)}
                disabled={disabled}
                placeholder={`Wrong answer ${i + 1}`}
                className="text-sm bg-background"
              />
              <AnswerChoiceImageControl
                imagePreview={wrongImagePreviews[i] ?? null}
                isUploading={uploadingWrongImageIndex === i}
                isBusy={disabled}
                fileInputRef={wrongImageInputRefs[i]!}
                onFileChange={(e) => onWrongImageChange(i, e)}
                onRemove={() => onWrongImageRemove(i)}
                altText={`Wrong answer ${i + 1} image`}
              />
            </div>
          </div>
        ))}
      </div>
    </EditCardSection>
  );
}

function StandardEditForm({
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
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [aiChoiceOpen, setAiChoiceOpen] = useState(false);
  const [aiImageSide, setAiImageSide] = useState<AiImageSide>("back");
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  const [isRegeneratingDistractors, setIsRegeneratingDistractors] = useState(false);
  const correctIdx = card.correctChoiceIndex ?? 0;
  const initialDistractors = extractDistractorsFromChoices(card.choices, correctIdx);
  const initialWrongImages = extractWrongChoiceImages(card.choiceImageUrls, correctIdx);
  const hasQuizChoices = (card.choices?.length ?? 0) >= 4;
  const [distractors, setDistractors] = useState<string[]>([...initialDistractors]);
  const [wrongImageUrls, setWrongImageUrls] = useState<
    [string | null, string | null, string | null]
  >([initialWrongImages[0], initialWrongImages[1], initialWrongImages[2]]);
  const [wrongImagePreviews, setWrongImagePreviews] = useState<
    [string | null, string | null, string | null]
  >([initialWrongImages[0], initialWrongImages[1], initialWrongImages[2]]);
  const [uploadingWrongImageIndex, setUploadingWrongImageIndex] = useState<number | null>(null);
  const wrongImageInputRef0 = useRef<HTMLInputElement>(null);
  const wrongImageInputRef1 = useRef<HTMLInputElement>(null);
  const wrongImageInputRef2 = useRef<HTMLInputElement>(null);
  const wrongImageInputRefs = [wrongImageInputRef0, wrongImageInputRef1, wrongImageInputRef2];
  const initialChoiceImageTuple = buildChoiceImageTuple(
    card.backImageUrl ?? initialCorrectAnswerImage(card.choiceImageUrls, correctIdx),
    initialWrongImages,
  );
  const [aiDistractors, setAiDistractors] = useState<[string, string, string] | null>(
    hasQuizChoices ? initialDistractors : null,
  );
  const [aiDistractorsFor, setAiDistractorsFor] = useState<string | null>(
    hasQuizChoices ? (card.back ?? "") : null,
  );
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  const frontSpeech = useSpeechRecognition((t) => setFront((prev) => prev + t));
  const backSpeech = useSpeechRecognition((t) => setBack((prev) => prev + t));
  const speechError = frontSpeech.error ?? backSpeech.error;

  const isUploading =
    isUploadingFront || isUploadingBack || uploadingWrongImageIndex !== null;
  const isBusy =
    isPending ||
    isUploading ||
    isGeneratingAnswer ||
    isGeneratingDiagram ||
    isRegeneratingDistractors;
  const frontHasContent = front.trim().length > 0 || !!frontImageUrl;
  const backHasContent = back.trim().length > 0 || !!backImageUrl;
  const allDistractorsFilled = distractors.every(
    (d, index) => d.trim().length > 0 || !!wrongImageUrls[index],
  );
  const showWrongAnswers = hasQuizChoices;

  function setDistractorAt(i: number, value: string) {
    setDistractors((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  async function handleWrongImageChange(
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      if (wrongImageInputRefs[index]?.current) {
        wrongImageInputRefs[index]!.current!.value = "";
      }
      return;
    }
    setError(null);
    setUploadingWrongImageIndex(index);
    setWrongImagePreviews((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = URL.createObjectURL(file);
      return next;
    });
    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadCardImageAction({ deckId }, formData);
      setWrongImageUrls((prev) => {
        const next: [string | null, string | null, string | null] = [...prev];
        next[index] = url;
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
      setWrongImagePreviews((prev) => {
        const next: [string | null, string | null, string | null] = [...prev];
        next[index] = wrongImageUrls[index];
        return next;
      });
    } finally {
      setUploadingWrongImageIndex(null);
      if (wrongImageInputRefs[index]?.current) {
        wrongImageInputRefs[index]!.current!.value = "";
      }
    }
  }

  function handleWrongImageRemove(index: number) {
    setWrongImageUrls((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = null;
      return next;
    });
    setWrongImagePreviews((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = null;
      return next;
    });
    if (wrongImageInputRefs[index]?.current) {
      wrongImageInputRefs[index]!.current!.value = "";
    }
  }

  async function handleRegenerateDistractors() {
    if (!front.trim()) {
      setError("Please enter a question or term on the front first.");
      return;
    }
    if (!back.trim()) {
      setError("Please enter an answer on the back first.");
      return;
    }
    setError(null);
    setIsRegeneratingDistractors(true);
    try {
      const result = await generateMultipleChoiceAction({
        deckId,
        question: front.trim(),
        correctAnswer: back.trim(),
      });
      setDistractors([...result.distractors]);
      setAiDistractors([result.distractors[0], result.distractors[1], result.distractors[2]]);
      setAiDistractorsFor(back.trim());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate wrong answers.",
      );
    } finally {
      setIsRegeneratingDistractors(false);
    }
  }

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

  async function handleGenerateAnswer(mode: AiGenerateMode) {
    if (!front.trim()) {
      setError("Please enter a question or term in the front field first.");
      return;
    }
    setAiChoiceOpen(false);
    setError(null);
    setAiWarning(null);
    frontSpeech.stop();
    backSpeech.stop();
    setIsGeneratingAnswer(true);
    try {
      const {
        answer,
        distractors,
        frontDiagram,
        backDiagram,
        distractorDiagrams,
        relevanceWarning,
      } = await generateAnswerAction({
        deckId,
        question: front.trim(),
        includeDiagram: mode === "diagram",
      });
      if (relevanceWarning) setAiWarning(relevanceWarning);
      setBack(answer);
      const hasValidDistractors =
        distractors.length === 3 && distractors.every((d) => d.trim().length > 0);
      if (hasValidDistractors) {
        setAiDistractors([distractors[0], distractors[1], distractors[2]]);
        setAiDistractorsFor(answer.trim());
        setDistractors([distractors[0], distractors[1], distractors[2]]);
      } else {
        setAiDistractors(null);
        setAiDistractorsFor(null);
      }
      setIsGeneratingAnswer(false);

      if (mode === "text" || mode === "illustration") return;

      if (!frontDiagram && !backDiagram) {
        setAiWarning(
          "Could not create a diagram for this question. The text answer was still updated.",
        );
        return;
      }

      setIsGeneratingDiagram(true);
      try {
        async function uploadDiagram(diagram: NonNullable<typeof frontDiagram>) {
          const { file } = await buildMathDiagramPngFile(diagram);
          const formData = new FormData();
          formData.append("image", file);
          const url = await uploadCardImageAction({ deckId }, formData);
          return { url, preview: URL.createObjectURL(file) };
        }

        if (frontDiagram) {
          const uploaded = await uploadDiagram(frontDiagram);
          setFrontImageUrl(uploaded.url);
          setFrontImagePreview(uploaded.preview);
        }
        if (backDiagram) {
          const uploaded = await uploadDiagram(backDiagram);
          setBackImageUrl(uploaded.url);
          setBackImagePreview(uploaded.preview);
        }

        if (showWrongAnswers && hasValidDistractors) {
          const nextUrls: [string | null, string | null, string | null] = [
            null,
            null,
            null,
          ];
          const nextPreviews: [string | null, string | null, string | null] = [
            null,
            null,
            null,
          ];
          for (let i = 0; i < 3; i++) {
            const d = distractorDiagrams[i];
            if (!d) continue;
            const uploaded = await uploadDiagram(d);
            nextUrls[i] = uploaded.url;
            nextPreviews[i] = uploaded.preview;
          }
          setWrongImageUrls(nextUrls);
          setWrongImagePreviews(nextPreviews);
        }
      } catch {
        setError("Could not render the math diagram. The text answer is still available.");
      } finally {
        setIsGeneratingDiagram(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate answer.");
      setIsGeneratingAnswer(false);
      setIsGeneratingDiagram(false);
    }
  }

  function handleSubmit() {
    setError(null);
    frontSpeech.stop();
    backSpeech.stop();
    const distractorsToSend = showWrongAnswers
      ? (distractors as [string, string, string])
      : aiDistractors && aiDistractorsFor !== null && aiDistractorsFor === back.trim()
        ? aiDistractors
        : null;
    startTransition(async () => {
      try {
        const choiceImageUrls = showWrongAnswers
          ? buildChoiceImageTuple(backImageUrl, wrongImageUrls)
          : undefined;
        await updateCardAction({
          cardId: card.id,
          deckId,
          front,
          frontImageUrl,
          back,
          backImageUrl,
          oldFrontImageUrl: card.frontImageUrl ?? null,
          oldBackImageUrl: card.backImageUrl ?? null,
          distractors: distractorsToSend,
          choiceImageUrls,
          oldChoiceImageUrls: showWrongAnswers ? initialChoiceImageTuple : undefined,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <EditCardSection title="Front">
        <EditCardTextField
          id={`front-${card.id}`}
          value={front}
          onChange={setFront}
          placeholder="Question or term… (optional if image added)"
          disabled={isBusy}
          actions={
            frontSpeech.supported ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button
                      type="button"
                      variant={frontSpeech.isRecording ? "destructive" : "outline"}
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={
                        frontSpeech.isRecording
                          ? "Stop recording front text"
                          : "Dictate front text with microphone"
                      }
                      onClick={() =>
                        frontSpeech.isRecording ? frontSpeech.stop() : frontSpeech.start()
                      }
                      disabled={isBusy || backSpeech.isRecording}
                    >
                      {frontSpeech.isRecording ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-center">
                    {frontSpeech.isRecording
                      ? "Stop recording"
                      : "Record with microphone — text is appended to this field"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null
          }
        />
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
      </EditCardSection>

      <EditCardSection title="Back">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`back-${card.id}`} className="text-xs sm:text-sm">
              Text
            </Label>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasAI && (
                <Popover open={aiChoiceOpen} onOpenChange={setAiChoiceOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="h-7 w-7"
                        disabled={!front.trim() || isBusy}
                        aria-label={
                          !front.trim()
                            ? "Enter a question or term first"
                            : "Generate an answer with AI"
                        }
                        title={
                          !front.trim()
                            ? "Enter a question or term first"
                            : "Generate an answer with AI"
                        }
                      />
                    }
                  >
                    <Sparkles
                      className={`h-3.5 w-3.5 ${isGeneratingAnswer || isGeneratingDiagram ? "animate-pulse" : ""}`}
                    />
                  </PopoverTrigger>
                  <AiGeneratePopoverContent
                    imageSide={aiImageSide}
                    onImageSideChange={setAiImageSide}
                    onGenerate={handleGenerateAnswer}
                    disabled={isBusy}
                    showIllustrationOption={false}
                  />
                </Popover>
              )}
              {backSpeech.supported && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span />}>
                      <Button
                        type="button"
                        variant={backSpeech.isRecording ? "destructive" : "outline"}
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={
                          backSpeech.isRecording
                            ? "Stop recording back text"
                            : "Dictate back text with microphone"
                        }
                        onClick={() =>
                          backSpeech.isRecording ? backSpeech.stop() : backSpeech.start()
                        }
                        disabled={isBusy || frontSpeech.isRecording}
                      >
                        {backSpeech.isRecording ? (
                          <MicOff className="h-3.5 w-3.5" />
                        ) : (
                          <Mic className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64 text-center">
                      {backSpeech.isRecording
                        ? "Stop recording"
                        : "Record with microphone — text is appended to this field"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Textarea
              id={`back-${card.id}`}
              placeholder="Answer or definition… (optional if image added)"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              rows={3}
              disabled={isBusy}
              className="text-sm bg-background flex-1"
            />
            <AnswerChoiceImageControl
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
              altText="Correct answer image"
            />
          </div>
        </div>
      </EditCardSection>

      {showWrongAnswers && (
        <WrongAnswersSection
          cardId={card.id}
          distractors={distractors}
          onDistractorChange={setDistractorAt}
          wrongImagePreviews={wrongImagePreviews}
          uploadingWrongImageIndex={uploadingWrongImageIndex}
          wrongImageInputRefs={wrongImageInputRefs}
          onWrongImageChange={handleWrongImageChange}
          onWrongImageRemove={handleWrongImageRemove}
          disabled={isBusy}
          hasAI={hasAI}
          onRegenerate={handleRegenerateDistractors}
          isRegenerating={isRegeneratingDistractors}
          canRegenerate={!!front.trim() && !!back.trim()}
        />
      )}

      {!frontSpeech.supported && !backSpeech.supported && (
        <p className="text-muted-foreground text-[11px] sm:text-xs">
          Voice dictation isn&apos;t supported in this browser. Try Chrome, Edge, or Safari.
        </p>
      )}

      {speechError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive whitespace-pre-line">
          {speechError}
        </div>
      )}

      {aiWarning && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-200 text-xs sm:text-sm">
          {aiWarning}
        </p>
      )}
      {error && <p className="text-destructive text-xs sm:text-sm">{error}</p>}

      <EditCardDialogFooter
        onCancel={() => {
          frontSpeech.stop();
          backSpeech.stop();
          frontSpeech.clearError();
          backSpeech.clearError();
          onClose();
        }}
        onSave={handleSubmit}
        isBusy={isBusy}
        saveDisabled={
          !frontHasContent ||
          !backHasContent ||
          (showWrongAnswers && !allDistractorsFilled)
        }
        saveLabel={
          isPending
            ? "Saving…"
            : isUploading
              ? "Uploading…"
              : isGeneratingAnswer || isRegeneratingDistractors
                ? "Generating…"
                : "Save changes"
        }
      />
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

  const initialCorrectImage = initialCorrectAnswerImage(card.choiceImageUrls, correctIdx);
  const initialWrongImages = extractWrongChoiceImages(card.choiceImageUrls, correctIdx);
  const initialChoiceImageTuple = buildChoiceImageTuple(initialCorrectImage, initialWrongImages);

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
  const [correctAnswerImageUrl, setCorrectAnswerImageUrl] = useState<string | null>(
    initialCorrectImage,
  );
  const [correctAnswerImagePreview, setCorrectAnswerImagePreview] = useState<string | null>(
    initialCorrectImage,
  );
  const [isUploadingCorrectImage, setIsUploadingCorrectImage] = useState(false);
  const correctAnswerImageInputRef = useRef<HTMLInputElement>(null);
  const [wrongImageUrls, setWrongImageUrls] = useState<
    [string | null, string | null, string | null]
  >([initialWrongImages[0], initialWrongImages[1], initialWrongImages[2]]);
  const [wrongImagePreviews, setWrongImagePreviews] = useState<
    [string | null, string | null, string | null]
  >([initialWrongImages[0], initialWrongImages[1], initialWrongImages[2]]);
  const [uploadingWrongImageIndex, setUploadingWrongImageIndex] = useState<number | null>(null);
  const wrongImageInputRef0 = useRef<HTMLInputElement>(null);
  const wrongImageInputRef1 = useRef<HTMLInputElement>(null);
  const wrongImageInputRef2 = useRef<HTMLInputElement>(null);
  const wrongImageInputRefs = [wrongImageInputRef0, wrongImageInputRef1, wrongImageInputRef2];
  const [isRegeneratingDistractors, setIsRegeneratingDistractors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const questionSpeech = useSpeechRecognition((t) => setQuestion((prev) => prev + t));
  const correctSpeech = useSpeechRecognition((t) => setCorrectAnswer((prev) => prev + t));
  const mcSpeechError = questionSpeech.error ?? correctSpeech.error;

  const isBusy =
    isPending ||
    isUploadingImage ||
    isRegeneratingDistractors ||
    isUploadingCorrectImage ||
    uploadingWrongImageIndex !== null;
  const questionHasContent = question.trim().length > 0 || !!questionImageUrl;
  const correctFilled = correctAnswer.trim().length > 0 || !!correctAnswerImageUrl;
  const allDistractorsFilled = distractors.every(
    (d, index) => d.trim().length > 0 || !!wrongImageUrls[index],
  );

  async function handleCorrectAnswerImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      if (correctAnswerImageInputRef.current) correctAnswerImageInputRef.current.value = "";
      return;
    }
    setError(null);
    setIsUploadingCorrectImage(true);
    setCorrectAnswerImagePreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadCardImageAction({ deckId }, formData);
      setCorrectAnswerImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
      setCorrectAnswerImagePreview(correctAnswerImageUrl);
    } finally {
      setIsUploadingCorrectImage(false);
      if (correctAnswerImageInputRef.current) correctAnswerImageInputRef.current.value = "";
    }
  }

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

  async function handleWrongImageChange(
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      if (wrongImageInputRefs[index]?.current) {
        wrongImageInputRefs[index]!.current!.value = "";
      }
      return;
    }
    setError(null);
    setUploadingWrongImageIndex(index);
    setWrongImagePreviews((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = URL.createObjectURL(file);
      return next;
    });
    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadCardImageAction({ deckId }, formData);
      setWrongImageUrls((prev) => {
        const next: [string | null, string | null, string | null] = [...prev];
        next[index] = url;
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
      setWrongImagePreviews((prev) => {
        const next: [string | null, string | null, string | null] = [...prev];
        next[index] = wrongImageUrls[index];
        return next;
      });
    } finally {
      setUploadingWrongImageIndex(null);
      if (wrongImageInputRefs[index]?.current) {
        wrongImageInputRefs[index]!.current!.value = "";
      }
    }
  }

  function handleWrongImageRemove(index: number) {
    setWrongImageUrls((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = null;
      return next;
    });
    setWrongImagePreviews((prev) => {
      const next: [string | null, string | null, string | null] = [...prev];
      next[index] = null;
      return next;
    });
    if (wrongImageInputRefs[index]?.current) {
      wrongImageInputRefs[index]!.current!.value = "";
    }
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
    questionSpeech.stop();
    correctSpeech.stop();
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
          choiceImageUrls: buildChoiceImageTuple(correctAnswerImageUrl, wrongImageUrls),
          oldChoiceImageUrls: initialChoiceImageTuple,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <EditCardSection title="Front">
        <EditCardTextField
          id={`mc-question-${card.id}`}
          value={question}
          onChange={setQuestion}
          placeholder="Question or term… (optional if image added)"
          disabled={isBusy}
          actions={
            questionSpeech.supported ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button
                      type="button"
                      variant={questionSpeech.isRecording ? "destructive" : "outline"}
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={
                        questionSpeech.isRecording
                          ? "Stop recording front text"
                          : "Dictate front text with microphone"
                      }
                      onClick={() =>
                        questionSpeech.isRecording ? questionSpeech.stop() : questionSpeech.start()
                      }
                      disabled={isBusy || correctSpeech.isRecording}
                    >
                      {questionSpeech.isRecording ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-center">
                    {questionSpeech.isRecording
                      ? "Stop recording"
                      : "Record with microphone — text is appended to this field"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null
          }
        />
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
          altText="Front image preview"
        />
      </EditCardSection>

      <EditCardSection title="Back">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={`mc-correct-${card.id}`} className="text-xs sm:text-sm">
              Text
            </Label>
            {correctSpeech.supported ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button
                      type="button"
                      variant={correctSpeech.isRecording ? "destructive" : "outline"}
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      aria-label={
                        correctSpeech.isRecording
                          ? "Stop recording back text"
                          : "Dictate back text with microphone"
                      }
                      onClick={() =>
                        correctSpeech.isRecording ? correctSpeech.stop() : correctSpeech.start()
                      }
                      disabled={isBusy || questionSpeech.isRecording}
                    >
                      {correctSpeech.isRecording ? (
                        <MicOff className="h-3.5 w-3.5" />
                      ) : (
                        <Mic className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-center">
                    {correctSpeech.isRecording
                      ? "Stop recording"
                      : "Record with microphone — text is appended to this field"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </div>
          <div className="flex items-start gap-2">
            <Textarea
              id={`mc-correct-${card.id}`}
              placeholder="Correct answer… (optional if image added)"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              rows={3}
              disabled={isBusy}
              className="text-sm bg-background flex-1"
            />
            <AnswerChoiceImageControl
              imagePreview={correctAnswerImagePreview}
              isUploading={isUploadingCorrectImage}
              isBusy={isBusy}
              fileInputRef={correctAnswerImageInputRef}
              onFileChange={handleCorrectAnswerImageChange}
              onRemove={() => {
                setCorrectAnswerImageUrl(null);
                setCorrectAnswerImagePreview(null);
                if (correctAnswerImageInputRef.current) {
                  correctAnswerImageInputRef.current.value = "";
                }
              }}
              altText="Correct answer image"
            />
          </div>
        </div>
      </EditCardSection>

      <WrongAnswersSection
        cardId={card.id}
        distractors={distractors}
        onDistractorChange={setDistractorAt}
        wrongImagePreviews={wrongImagePreviews}
        uploadingWrongImageIndex={uploadingWrongImageIndex}
        wrongImageInputRefs={wrongImageInputRefs}
        onWrongImageChange={handleWrongImageChange}
        onWrongImageRemove={handleWrongImageRemove}
        disabled={isBusy}
        hasAI={hasAI}
        onRegenerate={handleRegenerateDistractors}
        isRegenerating={isRegeneratingDistractors}
        canRegenerate={!!question.trim() && correctFilled}
      />

      {!questionSpeech.supported && !correctSpeech.supported && (
        <p className="text-muted-foreground text-[11px] sm:text-xs">
          Voice dictation isn&apos;t supported in this browser. Try Chrome, Edge, or Safari.
        </p>
      )}

      {mcSpeechError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive whitespace-pre-line">
          {mcSpeechError}
        </div>
      )}

      {error && <p className="text-destructive text-xs sm:text-sm">{error}</p>}

      <EditCardDialogFooter
        onCancel={() => {
          questionSpeech.stop();
          correctSpeech.stop();
          questionSpeech.clearError();
          correctSpeech.clearError();
          onClose();
        }}
        onSave={handleSubmit}
        isBusy={isBusy}
        saveDisabled={!questionHasContent || !correctFilled || !allDistractorsFilled}
        saveLabel={
          isPending
            ? "Saving…"
            : isUploadingImage || isUploadingCorrectImage
              ? "Uploading…"
              : isRegeneratingDistractors
                ? "Generating…"
                : "Save changes"
        }
      />
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
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Edit Card</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {isMC
              ? "Update the front, back, and 3 wrong answers. Each side can have text, an image, or both."
              : "Update the front and back. Each side can have text, an image, or both."}
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
          <StandardEditForm
            card={card}
            deckId={deckId}
            hasAI={hasAI}
            onClose={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
