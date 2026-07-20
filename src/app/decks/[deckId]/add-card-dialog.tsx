"use client";

import dynamic from "next/dynamic";
import { useState, useTransition, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AnswerChoiceImageControl,
  buildChoiceImageTuple,
} from "./answer-choice-image-control";
import {
  AiGeneratePopoverContent,
  type AiGenerateMode,
  type AiImageSide,
} from "./ai-generate-popover";
import {
  createCardAction,
  createMultipleChoiceCardAction,
  generateAnswerAction,
  generateMultipleChoiceAction,
  uploadCardImageAction,
} from "@/actions/cards";
import { AI_GENERATION_CAP_PER_DECK } from "@/lib/deck-limits";

const FromSourceCardForm = dynamic(
  () => import("./from-source-card-form").then((m) => m.FromSourceCardForm),
  { ssr: false },
);
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Info,
  Mic,
  MicOff,
  RefreshCw,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { buildMathDiagramPngFile } from "@/lib/math-diagrams/build-diagram-file";

interface AddCardDialogProps {
  deckId: number;
  deckName: string;
  trigger?: React.ReactElement;
  isAtLimit?: boolean;
  hasAI?: boolean;
  /** Pro Plus or team-tier workspace — PDF and future document types. */
  hasAdvancedSourceImport?: boolean;
  aiGeneratedCount?: number;
  totalCardCount?: number;
  deckCardLimit?: number;
  /** Paid tiers — Free users only get the standard card format in this dialog. */
  allowsMultipleChoiceFormat?: boolean;
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

function extensionForMediaType(mediaType: string): string {
  if (mediaType === "image/webp") return "webp";
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/gif") return "gif";
  return "png";
}

function blobToPendingFile(blob: Blob): File {
  const mediaType = blob.type || "image/webp";
  return new File(
    [blob],
    `ai-back-${Date.now()}.${extensionForMediaType(mediaType)}`,
    { type: mediaType },
  );
}

async function fetchAiBackImage(
  deckId: number,
  question: string,
  answer: string,
): Promise<Blob | null> {
  const response = await fetch("/api/ai/card-back-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deckId, question, answer }),
  });
  if (!response.ok) return null;
  return response.blob();
}

function isLocalImagePreview(url: string): boolean {
  return url.startsWith("blob:") || url.startsWith("data:");
}

/** Portal overlay — avoids nesting Dialog inside the Add Card dialog (portal teardown crash). */
function ImageEnlargeOverlay({
  open,
  onClose,
  imageSrc,
  altText,
}: {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  altText: string;
}) {
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
      aria-label="Enlarged image preview"
    >
      <div
        className="relative flex max-w-[min(calc(100vw-2rem),28rem)] flex-col overflow-hidden rounded-xl border-2 border-primary bg-card shadow-lg shadow-primary/30"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-primary/40 bg-primary px-3 py-2 pr-10">
          <p className="text-xs font-semibold text-primary-foreground">Image preview</p>
        </div>
        <div className="p-3">
          <Image
            src={imageSrc}
            alt={altText}
            width={640}
            height={480}
            className="mx-auto block h-auto max-h-[min(60vh,22rem)] w-auto max-w-[min(calc(100vw-3.5rem),26rem)] rounded-md border border-primary/35 bg-muted object-contain"
            unoptimized={isLocalImagePreview(imageSrc)}
            priority
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-2 right-2 text-primary-foreground hover:bg-primary-foreground/20"
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

function ImageUploadSection({
  label,
  imagePreview,
  isUploading,
  isBusy,
  fileInputRef,
  onFileChange,
  onRemove,
  altText,
  enableEnlarge = false,
}: {
  label: string;
  imagePreview: string | null;
  isUploading: boolean;
  isBusy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  altText: string;
  enableEnlarge?: boolean;
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
            "relative w-full h-32 sm:h-48 rounded-lg overflow-hidden border border-border bg-muted/30",
            enableEnlarge && !isUploading && "cursor-zoom-in",
          )}
          title={enableEnlarge ? "Double-click to enlarge" : undefined}
          onDoubleClick={
            enableEnlarge && !isUploading
              ? (event) => {
                  event.preventDefault();
                  setEnlargeOpen(true);
                }
              : undefined
          }
        >
          <Image
            src={imagePreview}
            alt={altText}
            fill
            className="object-contain pointer-events-none"
            unoptimized={isLocalImagePreview(imagePreview)}
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

      {enableEnlarge && imagePreview ? (
        <ImageEnlargeOverlay
          open={enlargeOpen}
          onClose={() => setEnlargeOpen(false)}
          imageSrc={imagePreview}
          altText={altText}
        />
      ) : null}
    </div>
  );
}

function useSpeechRecognition(onAppend: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) setSupported(false);
    }
  }, []);

  function start() {
    if (typeof window === "undefined") return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition is not supported in your browser.");
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
    };
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        }
      }
      if (finalTranscript) onAppend(finalTranscript);
    };
    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
      stop();
    };
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stop() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  return { isRecording, supported, error, start, stop, setError };
}

// ───────────────────────── Standard (Q&A) form ─────────────────────────

function StandardCardForm({
  deckId,
  hasAI,
  onSuccess,
  onCancel,
}: {
  deckId: number;
  hasAI: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [front, setFront] = useState("");
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [frontImagePreview, setFrontImagePreview] = useState<string | null>(null);
  const [frontPendingFile, setFrontPendingFile] = useState<File | null>(null);
  const [isUploadingFront, setIsUploadingFront] = useState(false);
  const [back, setBack] = useState("");
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [backPendingFile, setBackPendingFile] = useState<File | null>(null);
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [aiChoiceOpen, setAiChoiceOpen] = useState(false);
  /** Where AI diagram / illustration is attached on the card. */
  const [aiImageSide, setAiImageSide] = useState<AiImageSide>("back");
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [isGeneratingBackImage, setIsGeneratingBackImage] = useState(false);
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  // AI-generated wrong answers paired with the current back text. Hidden from
  // the UI — only sent along with createCardAction so they are persisted on
  // the card for later use.
  const [aiDistractors, setAiDistractors] = useState<[string, string, string] | null>(null);
  const [aiDistractorsFor, setAiDistractorsFor] = useState<string | null>(null);

  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  const frontSpeech = useSpeechRecognition((t) => setFront((prev) => prev + t));
  const backSpeech = useSpeechRecognition((t) => setBack((prev) => prev + t));

  const isUploading = isUploadingFront || isUploadingBack;
  const isBusy =
    isPending ||
    isUploading ||
    isGeneratingAnswer ||
    isGeneratingBackImage ||
    isGeneratingDiagram;
  const frontHasContent =
    front.trim().length > 0 || !!frontImageUrl || !!frontImagePreview;
  const backHasContent =
    back.trim().length > 0 || !!backImageUrl || !!backImagePreview;

  async function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (u: string | null) => void,
    setPreview: (u: string | null) => void,
    setIsUploading: (b: boolean) => void,
    fileRef: React.RefObject<HTMLInputElement | null>,
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
      setPreview(null);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSubmit() {
    setError(null);
    frontSpeech.stop();
    backSpeech.stop();
    // Only send AI distractors if they still match the current back text (the
    // user may have edited the back after AI generation, in which case the
    // old distractors would be misleading).
    const distractorsToSend =
      aiDistractors && aiDistractorsFor !== null && aiDistractorsFor === back.trim()
        ? aiDistractors
        : null;
    startTransition(async () => {
      try {
        let resolvedFrontImageUrl = frontImageUrl;
        if (frontPendingFile && !frontImageUrl) {
          setIsUploadingFront(true);
          try {
            const formData = new FormData();
            formData.append("image", frontPendingFile);
            resolvedFrontImageUrl = await uploadCardImageAction({ deckId }, formData);
          } finally {
            setIsUploadingFront(false);
          }
        }

        let resolvedBackImageUrl = backImageUrl;
        if (backPendingFile && !backImageUrl) {
          setIsUploadingBack(true);
          try {
            const formData = new FormData();
            formData.append("image", backPendingFile);
            resolvedBackImageUrl = await uploadCardImageAction({ deckId }, formData);
          } finally {
            setIsUploadingBack(false);
          }
        }

        await createCardAction({
          deckId,
          front,
          frontImageUrl: resolvedFrontImageUrl,
          back,
          backImageUrl: resolvedBackImageUrl,
          distractors: distractorsToSend,
        });
        setFront("");
        setFrontImageUrl(null);
        setFrontImagePreview(null);
        setFrontPendingFile(null);
        setBack("");
        setBackImageUrl(null);
        setBackImagePreview(null);
        setBackPendingFile(null);
        setAiDistractors(null);
        setAiDistractorsFor(null);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function clearPendingImageSide(side: AiImageSide) {
    if (side === "front") {
      if (frontImagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(frontImagePreview);
      }
      setFrontPendingFile(null);
      setFrontImageUrl(null);
      setFrontImagePreview(null);
      return;
    }
    if (backImagePreview?.startsWith("blob:")) {
      URL.revokeObjectURL(backImagePreview);
    }
    setBackPendingFile(null);
    setBackImageUrl(null);
    setBackImagePreview(null);
  }

  function applyPendingImage(side: AiImageSide, file: File) {
    clearPendingImageSide(side);
    const previewUrl = URL.createObjectURL(file);
    if (side === "front") {
      setFrontPendingFile(file);
      setFrontImagePreview(previewUrl);
    } else {
      setBackPendingFile(file);
      setBackImagePreview(previewUrl);
    }
  }

  async function runAiGeneration(mode: AiGenerateMode) {
    if (!front.trim()) {
      setError("Please enter a question or term in the front field first.");
      return;
    }
    const imageSide = aiImageSide;
    setAiChoiceOpen(false);
    setError(null);
    setAiWarning(null);
    setIsGeneratingAnswer(true);
    try {
      const question = front.trim();
      const {
        answer,
        distractors,
        frontDiagram,
        backDiagram,
        relevanceWarning,
      } = await generateAnswerAction({
        deckId,
        question,
        includeDiagram: mode === "diagram",
      });
      if (relevanceWarning) setAiWarning(relevanceWarning);
      setBack(answer);
      // Stash distractors keyed to the exact answer the user is about to see.
      // If they later edit the back, we drop these at submit time.
      const hasValidDistractors =
        distractors.length === 3 && distractors.every((d) => d.trim().length > 0);
      if (hasValidDistractors) {
        setAiDistractors([distractors[0], distractors[1], distractors[2]]);
        setAiDistractorsFor(answer.trim());
      } else {
        setAiDistractors(null);
        setAiDistractorsFor(null);
      }

      setIsGeneratingAnswer(false);

      if (mode === "text") return;

      if (mode === "diagram") {
        if (!frontDiagram && !backDiagram) {
          setAiWarning(
            "Could not create a diagram for this question. Try Answer with image, or rephrase as a visual problem.",
          );
          return;
        }
        setIsGeneratingDiagram(true);
        try {
          // Front = question (no answer); back = solution (with answer).
          if (frontDiagram) {
            const { file } = await buildMathDiagramPngFile(frontDiagram);
            applyPendingImage("front", file);
          }
          if (backDiagram) {
            const { file } = await buildMathDiagramPngFile(backDiagram);
            applyPendingImage("back", file);
          }
        } catch {
          setError("Could not render the math diagram. The text answer is still available.");
        } finally {
          setIsGeneratingDiagram(false);
        }
        return;
      }

      setIsGeneratingBackImage(true);
      try {
        const imageBlob = await fetchAiBackImage(deckId, question, answer);
        if (imageBlob) {
          applyPendingImage(imageSide, blobToPendingFile(imageBlob));
        }
      } catch {
        // Answer text is still usable when image generation fails.
      } finally {
        setIsGeneratingBackImage(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate answer.");
      setIsGeneratingAnswer(false);
      setIsGeneratingBackImage(false);
      setIsGeneratingDiagram(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 py-2">
      {/* Front */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Front
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="front" className="text-xs sm:text-sm">
              Text <span className="text-muted-foreground font-normal">(question, term, etc.)</span>
            </Label>
            <div className="flex items-center gap-1.5">
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
                      className={`h-3.5 w-3.5 ${isGeneratingAnswer || isGeneratingBackImage || isGeneratingDiagram ? "animate-pulse" : ""}`}
                    />
                  </PopoverTrigger>
                  <AiGeneratePopoverContent
                    imageSide={aiImageSide}
                    onImageSideChange={setAiImageSide}
                    onGenerate={runAiGeneration}
                    disabled={isBusy}
                  />
                </Popover>
              )}
              {frontSpeech.supported && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span />}>
                      <Button
                        type="button"
                        variant={frontSpeech.isRecording ? "destructive" : "outline"}
                        size="icon"
                        className="h-7 w-7"
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
                    <TooltipContent>
                      {frontSpeech.isRecording ? "Stop recording" : "Record with microphone"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          <Textarea
            id="front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={3}
            disabled={isBusy}
            className="text-sm"
          />
        </div>
        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px bg-border"></div>
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border"></div>
        </div>
        <ImageUploadSection
          label="Image (optional)"
          imagePreview={frontImagePreview}
          isUploading={isUploadingFront}
          isBusy={isBusy}
          fileInputRef={frontFileInputRef}
          onFileChange={(e) => {
            setFrontPendingFile(null);
            handleImageChange(
              e,
              setFrontImageUrl,
              setFrontImagePreview,
              setIsUploadingFront,
              frontFileInputRef,
            );
          }}
          onRemove={() => {
            if (frontImagePreview?.startsWith("blob:")) {
              URL.revokeObjectURL(frontImagePreview);
            }
            setFrontImageUrl(null);
            setFrontImagePreview(null);
            setFrontPendingFile(null);
            if (frontFileInputRef.current) frontFileInputRef.current.value = "";
          }}
          altText="Front image preview"
          enableEnlarge
        />
        {isGeneratingDiagram && !frontImagePreview && !backImagePreview ? (
          <p className="text-xs text-muted-foreground animate-pulse">
            Generating math diagram…
          </p>
        ) : null}
      </div>

      {/* Back */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Back
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="back" className="text-xs sm:text-sm">
              Text{" "}
              <span className="text-muted-foreground font-normal">
                (answer, definition, etc.)
              </span>
            </Label>
            {backSpeech.supported && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span />}>
                    <Button
                      type="button"
                      variant={backSpeech.isRecording ? "destructive" : "outline"}
                      size="icon"
                      className="h-7 w-7"
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
                  <TooltipContent>
                    {backSpeech.isRecording ? "Stop recording" : "Record with microphone"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Textarea
            id="back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            rows={3}
            disabled={isBusy}
            className="text-sm"
          />
        </div>
        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px bg-border"></div>
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border"></div>
        </div>
        <ImageUploadSection
          label="Image (optional)"
          imagePreview={backImagePreview}
          isUploading={isUploadingBack}
          isBusy={isBusy}
          fileInputRef={backFileInputRef}
          onFileChange={(e) => {
            setBackPendingFile(null);
            handleImageChange(
              e,
              setBackImageUrl,
              setBackImagePreview,
              setIsUploadingBack,
              backFileInputRef,
            );
          }}
          onRemove={() => {
            if (backImagePreview?.startsWith("blob:")) {
              URL.revokeObjectURL(backImagePreview);
            }
            setBackImageUrl(null);
            setBackImagePreview(null);
            setBackPendingFile(null);
            if (backFileInputRef.current) backFileInputRef.current.value = "";
          }}
          altText="Back image preview"
          enableEnlarge
        />
        {isGeneratingBackImage && !backImagePreview ? (
          <p className="text-xs text-muted-foreground animate-pulse">
            Generating illustration…
          </p>
        ) : null}
      </div>

      {aiWarning && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-amber-200 text-xs sm:text-sm">{aiWarning}</p>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-destructive text-xs sm:text-sm">{error}</p>
        </div>
      )}

      <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
        <Button
          variant="outline"
          onClick={onCancel}
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
          {isPending
            ? "Adding…"
            : isUploading
              ? "Uploading…"
              : isGeneratingAnswer || isGeneratingBackImage || isGeneratingDiagram
                ? "Generating…"
                : "Add Card"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─────────────────────── Multiple Choice form ───────────────────────

function MultipleChoiceCardForm({
  deckId,
  hasAI,
  onSuccess,
  onCancel,
}: {
  deckId: number;
  hasAI: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [questionImageUrl, setQuestionImageUrl] = useState<string | null>(null);
  const [questionImagePreview, setQuestionImagePreview] = useState<string | null>(null);
  const [questionPendingFile, setQuestionPendingFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [correctAnswerImageUrl, setCorrectAnswerImageUrl] = useState<string | null>(null);
  const [correctAnswerImagePreview, setCorrectAnswerImagePreview] = useState<string | null>(null);
  const [isUploadingCorrectImage, setIsUploadingCorrectImage] = useState(false);
  const correctAnswerImageInputRef = useRef<HTMLInputElement>(null);
  const [distractors, setDistractors] = useState<string[]>(["", "", ""]);
  const [wrongImageUrls, setWrongImageUrls] = useState<
    [string | null, string | null, string | null]
  >([null, null, null]);
  const [wrongImagePreviews, setWrongImagePreviews] = useState<
    [string | null, string | null, string | null]
  >([null, null, null]);
  const [uploadingWrongImageIndex, setUploadingWrongImageIndex] = useState<number | null>(null);
  const wrongImageInputRef0 = useRef<HTMLInputElement>(null);
  const wrongImageInputRef1 = useRef<HTMLInputElement>(null);
  const wrongImageInputRef2 = useRef<HTMLInputElement>(null);
  const wrongImageInputRefs = [wrongImageInputRef0, wrongImageInputRef1, wrongImageInputRef2];
  const [showDistractors, setShowDistractors] = useState(true);
  const [isRegeneratingDistractors, setIsRegeneratingDistractors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [aiChoiceOpen, setAiChoiceOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingQuestionImage, setIsGeneratingQuestionImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const speech = useSpeechRecognition((t) => setQuestion((prev) => prev + t));

  const isBusy =
    isPending ||
    isUploadingImage ||
    isUploadingCorrectImage ||
    uploadingWrongImageIndex !== null ||
    isGenerating ||
    isGeneratingQuestionImage ||
    isRegeneratingDistractors;
  const questionHasContent =
    question.trim().length > 0 || !!questionImageUrl || !!questionImagePreview;
  const correctFilled = correctAnswer.trim().length > 0 || !!correctAnswerImageUrl;
  const allDistractorsFilled = distractors.every(
    (d, index) => d.trim().length > 0 || !!wrongImageUrls[index],
  );

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
    setQuestionPendingFile(null);
    setIsUploadingImage(true);
    setQuestionImagePreview(URL.createObjectURL(file));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const url = await uploadCardImageAction({ deckId }, formData);
      setQuestionImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
      setQuestionImagePreview(null);
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

  async function runMcAiGeneration(includeImage: boolean) {
    if (!question.trim()) {
      setError("Please enter a question first.");
      return;
    }
    setAiChoiceOpen(false);
    setError(null);
    setAiWarning(null);
    setIsGenerating(true);
    let resolvedCorrect = correctAnswer.trim();
    try {
      const result = await generateMultipleChoiceAction({
        deckId,
        question: question.trim(),
        correctAnswer: correctFilled ? resolvedCorrect : null,
      });
      if (result.relevanceWarning) setAiWarning(result.relevanceWarning);
      if (!correctFilled) {
        setCorrectAnswer(result.correctAnswer);
        resolvedCorrect = result.correctAnswer.trim();
      }
      setDistractors([...result.distractors]);
      setShowDistractors(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate answers.");
      setIsGenerating(false);
      return;
    }
    setIsGenerating(false);

    if (!includeImage || !resolvedCorrect) return;

    if (questionImagePreview?.startsWith("blob:") && questionPendingFile) {
      URL.revokeObjectURL(questionImagePreview);
    }
    setQuestionPendingFile(null);
    setQuestionImageUrl(null);
    setQuestionImagePreview(null);

    setIsGeneratingQuestionImage(true);
    try {
      const imageBlob = await fetchAiBackImage(
        deckId,
        question.trim(),
        resolvedCorrect,
      );
      if (imageBlob) {
        const pendingFile = blobToPendingFile(imageBlob);
        setQuestionPendingFile(pendingFile);
        setQuestionImagePreview(URL.createObjectURL(pendingFile));
      }
    } catch {
      // Answers are still usable when image generation fails.
    } finally {
      setIsGeneratingQuestionImage(false);
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
    setAiWarning(null);
    setIsRegeneratingDistractors(true);
    try {
      const result = await generateMultipleChoiceAction({
        deckId,
        question: question.trim(),
        correctAnswer: correctAnswer.trim(),
      });
      if (result.relevanceWarning) setAiWarning(result.relevanceWarning);
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
    speech.stop();
    startTransition(async () => {
      try {
        let resolvedQuestionImageUrl = questionImageUrl;
        if (questionPendingFile && !questionImageUrl) {
          setIsUploadingImage(true);
          try {
            const formData = new FormData();
            formData.append("image", questionPendingFile);
            resolvedQuestionImageUrl = await uploadCardImageAction({ deckId }, formData);
          } finally {
            setIsUploadingImage(false);
          }
        }

        await createMultipleChoiceCardAction({
          deckId,
          question,
          questionImageUrl: resolvedQuestionImageUrl,
          correctAnswer,
          distractors,
          choiceImageUrls: buildChoiceImageTuple(correctAnswerImageUrl, wrongImageUrls),
        });
        setQuestion("");
        setQuestionImageUrl(null);
        setQuestionImagePreview(null);
        setQuestionPendingFile(null);
        setCorrectAnswer("");
        setCorrectAnswerImageUrl(null);
        setCorrectAnswerImagePreview(null);
        setDistractors(["", "", ""]);
        setWrongImageUrls([null, null, null]);
        setWrongImagePreviews([null, null, null]);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const aiChoiceTitle = correctFilled ? "AI distractors" : "AI generate";
  const aiWithImageLabel = correctFilled ? "Distractors + image" : "Answers + image";
  const aiWithImageHint = correctFilled
    ? "Regenerate wrong answers and add a question illustration."
    : "Generate correct answer, wrong answers, and a question illustration.";
  const aiTextOnlyLabel = correctFilled ? "Distractors only" : "Answers only";
  const aiTextOnlyHint = correctFilled
    ? "Regenerate the 3 wrong answers only."
    : "Generate correct answer and wrong answers only.";

  return (
    <div className="flex flex-col gap-4 sm:gap-5 py-2">
      {/* Question */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Question
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="mc-question" className="text-xs sm:text-sm">
              Text <span className="text-muted-foreground font-normal">(the prompt)</span>
            </Label>
            <div className="flex items-center gap-1.5">
              {speech.supported && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span />}>
                      <Button
                        type="button"
                        variant={speech.isRecording ? "destructive" : "outline"}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => (speech.isRecording ? speech.stop() : speech.start())}
                        disabled={isBusy}
                      >
                        {speech.isRecording ? (
                          <MicOff className="h-3.5 w-3.5" />
                        ) : (
                          <Mic className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {speech.isRecording ? "Stop recording" : "Record with microphone"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          <Textarea
            id="mc-question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            disabled={isBusy}
            placeholder="e.g. What is the capital of France?"
            className="text-sm"
          />
        </div>
        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px bg-border"></div>
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border"></div>
        </div>
        <ImageUploadSection
          label="Image (optional)"
          imagePreview={questionImagePreview}
          isUploading={isUploadingImage}
          isBusy={isBusy}
          fileInputRef={imageFileInputRef}
          onFileChange={handleImageChange}
          onRemove={() => {
            if (questionImagePreview?.startsWith("blob:")) {
              URL.revokeObjectURL(questionImagePreview);
            }
            setQuestionImageUrl(null);
            setQuestionImagePreview(null);
            setQuestionPendingFile(null);
            if (imageFileInputRef.current) imageFileInputRef.current.value = "";
          }}
          altText="Question image preview"
          enableEnlarge
        />
        {isGeneratingQuestionImage && !questionImagePreview ? (
          <p className="text-xs text-muted-foreground animate-pulse">
            Generating illustration…
          </p>
        ) : null}
      </div>

      {/* Answers */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Answers
          </p>
          {hasAI && (
            <Popover open={aiChoiceOpen} onOpenChange={setAiChoiceOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    disabled={!question.trim() || isBusy}
                    aria-label={
                      !question.trim()
                        ? "Enter a question first"
                        : correctFilled
                          ? "Generate distractors with AI"
                          : "Generate answers with AI"
                    }
                    title={
                      !question.trim()
                        ? "Enter a question first"
                        : correctFilled
                          ? "Generate distractors with AI"
                          : "Generate answers with AI"
                    }
                  />
                }
              >
                <Sparkles
                  className={`h-3.5 w-3.5 ${isGenerating || isGeneratingQuestionImage ? "animate-pulse" : ""}`}
                />
                {isGenerating || isGeneratingQuestionImage
                  ? "Generating…"
                  : correctFilled
                    ? "AI distractors"
                    : "AI generate"}
              </PopoverTrigger>
              <PopoverContent align="end" className="z-[60] w-64 gap-3 p-3">
                <PopoverHeader className="gap-1">
                  <PopoverTitle className="text-sm">{aiChoiceTitle}</PopoverTitle>
                  <PopoverDescription className="text-xs leading-relaxed">
                    Uses your deck name, description, and existing cards for style and scope.
                  </PopoverDescription>
                </PopoverHeader>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-auto justify-start gap-2 px-3 py-2.5 text-left whitespace-normal"
                    onClick={() => runMcAiGeneration(true)}
                    disabled={isBusy}
                  >
                    <ImagePlus className="h-4 w-4 shrink-0" />
                    <span>
                      <span className="block font-medium">{aiWithImageLabel}</span>
                      <span className="block text-[11px] font-normal text-primary-foreground/80">
                        {aiWithImageHint} Image is saved only when you click Add Card.
                      </span>
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto justify-start gap-2 px-3 py-2.5 text-left whitespace-normal"
                    onClick={() => runMcAiGeneration(false)}
                    disabled={isBusy}
                  >
                    <Type className="h-4 w-4 shrink-0" />
                    <span>
                      <span className="block font-medium">{aiTextOnlyLabel}</span>
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {aiTextOnlyHint}
                      </span>
                    </span>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Correct answer */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="mc-correct"
            className="text-xs sm:text-sm flex items-center gap-1.5"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            Correct answer
          </Label>
          <div className="flex items-start gap-2">
            <Input
              id="mc-correct"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              disabled={isBusy}
              placeholder="The right answer"
              className="text-sm border-emerald-500/40 focus-visible:ring-emerald-500/30"
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

        {/* Distractors */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 -ml-2 px-2 gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setShowDistractors((v) => !v)}
              aria-expanded={showDistractors}
              aria-controls="mc-distractors"
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
            <div id="mc-distractors" className="flex flex-col gap-2">
              {distractors.map((d, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Input
                    value={d}
                    onChange={(e) => setDistractorAt(i, e.target.value)}
                    disabled={isBusy}
                    placeholder={`Wrong answer ${i + 1}`}
                    className="text-sm"
                  />
                  <AnswerChoiceImageControl
                    imagePreview={wrongImagePreviews[i] ?? null}
                    isUploading={uploadingWrongImageIndex === i}
                    isBusy={isBusy}
                    fileInputRef={wrongImageInputRefs[i]!}
                    onFileChange={(e) => handleWrongImageChange(i, e)}
                    onRemove={() => handleWrongImageRemove(i)}
                    altText={`Wrong answer ${i + 1} image`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {hasAI && (
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Tip: type a question, then press <span className="font-medium">AI generate</span> to
            fill in the correct answer and 3 distractors. If you already typed the correct
            answer, AI will generate just the 3 wrong answers — staying in your deck&apos;s topic
            and matching the style of your existing cards.
          </p>
        )}
      </div>

      {aiWarning && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-amber-200 text-xs sm:text-sm">{aiWarning}</p>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-destructive text-xs sm:text-sm">{error}</p>
        </div>
      )}

      <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
        <Button
          variant="outline"
          onClick={onCancel}
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
            ? "Adding…"
            : isUploadingImage || isUploadingCorrectImage
              ? "Uploading…"
              : isGenerating || isGeneratingQuestionImage || isRegeneratingDistractors
                ? "Generating…"
                : "Add Card"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ───────────────────────── Dialog shell ─────────────────────────

export function AddCardDialog({
  deckId,
  deckName,
  trigger,
  isAtLimit = false,
  hasAI = false,
  hasAdvancedSourceImport = false,
  aiGeneratedCount = 0,
  totalCardCount = 0,
  deckCardLimit = 0,
  allowsMultipleChoiceFormat = true,
}: AddCardDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"standard" | "multiple_choice" | "from_source">("standard");

  const effectiveTab = allowsMultipleChoiceFormat ? tab : tab === "multiple_choice" ? "standard" : tab;
  const remainingAiSlots = Math.max(0, AI_GENERATION_CAP_PER_DECK - aiGeneratedCount);
  const remainingDeckSlots = Math.max(0, deckCardLimit - totalCardCount);
  const tabColumnCount =
    hasAI && allowsMultipleChoiceFormat ? 3 : hasAI ? 2 : allowsMultipleChoiceFormat ? 2 : 1;

  useEffect(() => {
    if (open && !allowsMultipleChoiceFormat && tab === "multiple_choice") {
      setTab("standard");
    }
  }, [open, allowsMultipleChoiceFormat, tab]);

  if (isAtLimit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} />}>
            <Button
              variant="default"
              size="sm"
              disabled
              className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 font-bold"
            >
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

  function handleSuccess() {
    setOpen(false);
    // Refresh after the dialog portal has fully unmounted — revalidating too
    // early can crash React teardown (`removeChild on null`).
    window.setTimeout(() => router.refresh(), 150);
  }

  function handleCancel() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger
          render={
            <Button
              variant="default"
              className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4 font-bold"
            />
          }
        >
          + Add Card
        </DialogTrigger>
      )}
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:max-w-lg mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Add a new card</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Adding to{" "}
            <span className="font-semibold text-foreground break-words">
              {deckName}
            </span>
          </p>
          <DialogDescription className="text-xs sm:text-sm">
            {allowsMultipleChoiceFormat
              ? hasAI
                ? "Choose a card format, or import study material with AI."
                : "Choose a card format: a classic question-and-answer card, or a multiple-choice card."
              : "On the Free plan, new cards use the standard question-and-answer format. Upgrade to Pro to add multiple-choice cards."}
          </DialogDescription>
        </DialogHeader>

        {hasAI && (
          <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 text-[11px] sm:text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="leading-relaxed">
              AI uses your <span className="text-foreground font-medium">deck name, description, and existing cards</span> to keep new cards consistent in style, scope, and difficulty. The more cards you add, the more accurate AI suggestions become.
            </p>
          </div>
        )}

        <Tabs
          value={effectiveTab}
          onValueChange={(v) => {
            if (v === "multiple_choice" && !allowsMultipleChoiceFormat) return;
            setTab(v as "standard" | "multiple_choice" | "from_source");
          }}
          className="gap-3"
        >
          <TabsList
            className={cn(
              "w-full grid h-9",
              tabColumnCount === 3 && "grid-cols-3",
              tabColumnCount === 2 && "grid-cols-2",
              tabColumnCount === 1 && "grid-cols-1",
            )}
          >
            <TabsTrigger value="standard">Standard</TabsTrigger>
            {allowsMultipleChoiceFormat ? (
              <TabsTrigger value="multiple_choice">Multiple Choice</TabsTrigger>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={(props) => (
                    <span
                      {...props}
                      className={cn(
                        "flex min-h-9 min-w-0 flex-1 cursor-not-allowed items-stretch rounded-md",
                        props.className,
                      )}
                    >
                      <TabsTrigger
                        value="multiple_choice"
                        disabled
                        className="pointer-events-none w-full opacity-40"
                      >
                        Multiple Choice
                      </TabsTrigger>
                    </span>
                  )}
                />
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  <p>
                    Multiple choice is a Pro feature. Upgrade your personal plan to unlock this
                    format.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-2 inline-block font-medium text-primary underline underline-offset-2 hover:opacity-90"
                  >
                    View Pro plans
                  </Link>
                </TooltipContent>
              </Tooltip>
            )}
            {hasAI ? <TabsTrigger value="from_source">From source</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="standard" keepMounted>
            <StandardCardForm
              deckId={deckId}
              hasAI={hasAI}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </TabsContent>

          <TabsContent value="multiple_choice" keepMounted>
            <MultipleChoiceCardForm
              deckId={deckId}
              hasAI={hasAI}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </TabsContent>

          {hasAI ? (
            <TabsContent value="from_source" keepMounted>
              <FromSourceCardForm
                deckId={deckId}
                hasAdvancedSourceImport={hasAdvancedSourceImport}
                remainingAiSlots={remainingAiSlots}
                remainingDeckSlots={remainingDeckSlots}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </TabsContent>
          ) : null}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
