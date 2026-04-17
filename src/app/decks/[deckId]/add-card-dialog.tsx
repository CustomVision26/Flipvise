"use client";

import { useState, useTransition, useRef, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  createCardAction,
  createMultipleChoiceCardAction,
  generateAnswerAction,
  generateMultipleChoiceAction,
  uploadCardImageAction,
} from "@/actions/cards";
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
  X,
} from "lucide-react";

interface AddCardDialogProps {
  deckId: number;
  trigger?: React.ReactElement;
  isAtLimit?: boolean;
  hasAI?: boolean;
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
  const [isUploadingFront, setIsUploadingFront] = useState(false);
  const [back, setBack] = useState("");
  const [backImageUrl, setBackImageUrl] = useState<string | null>(null);
  const [backImagePreview, setBackImagePreview] = useState<string | null>(null);
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
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
  const isBusy = isPending || isUploading || isGeneratingAnswer;
  const frontHasContent = front.trim().length > 0 || !!frontImageUrl;
  const backHasContent = back.trim().length > 0 || !!backImageUrl;

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
        await createCardAction({
          deckId,
          front,
          frontImageUrl,
          back,
          backImageUrl,
          distractors: distractorsToSend,
        });
        setFront("");
        setFrontImageUrl(null);
        setFrontImagePreview(null);
        setBack("");
        setBackImageUrl(null);
        setBackImagePreview(null);
        setAiDistractors(null);
        setAiDistractorsFor(null);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  async function handleGenerateAnswer() {
    if (!front.trim()) {
      setError("Please enter a question or term in the front field first.");
      return;
    }
    setError(null);
    setIsGeneratingAnswer(true);
    try {
      const { answer, distractors } = await generateAnswerAction({
        deckId,
        question: front.trim(),
      });
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate answer.");
    } finally {
      setIsGeneratingAnswer(false);
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={<span />}>
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleGenerateAnswer}
                        disabled={!front.trim() || isBusy}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64 text-center">
                      {!front.trim()
                        ? "Enter a question or term first"
                        : "Generate answer with AI. Uses your deck name, description, and existing cards so the answer matches your deck's style and scope."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
          onFileChange={(e) =>
            handleImageChange(
              e,
              setFrontImageUrl,
              setFrontImagePreview,
              setIsUploadingFront,
              frontFileInputRef,
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
          onFileChange={(e) =>
            handleImageChange(
              e,
              setBackImageUrl,
              setBackImagePreview,
              setIsUploadingBack,
              backFileInputRef,
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
          {isPending ? "Adding…" : isUploading ? "Uploading…" : "Add Card"}
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [distractors, setDistractors] = useState<string[]>(["", "", ""]);
  const [showDistractors, setShowDistractors] = useState(true);
  const [isRegeneratingDistractors, setIsRegeneratingDistractors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const speech = useSpeechRecognition((t) => setQuestion((prev) => prev + t));

  const isBusy = isPending || isUploadingImage || isGenerating || isRegeneratingDistractors;
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

  async function handleGenerate() {
    if (!question.trim()) {
      setError("Please enter a question first.");
      return;
    }
    setError(null);
    setIsGenerating(true);
    try {
      const result = await generateMultipleChoiceAction({
        deckId,
        question: question.trim(),
        correctAnswer: correctFilled ? correctAnswer.trim() : null,
      });
      if (!correctFilled) setCorrectAnswer(result.correctAnswer);
      setDistractors([...result.distractors]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate answers.");
    } finally {
      setIsGenerating(false);
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
        await createMultipleChoiceCardAction({
          deckId,
          question,
          questionImageUrl,
          correctAnswer,
          distractors,
        });
        setQuestion("");
        setQuestionImageUrl(null);
        setQuestionImagePreview(null);
        setCorrectAnswer("");
        setDistractors(["", "", ""]);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  const aiTooltip = !question.trim()
    ? "Enter a question first"
    : correctFilled
      ? "Generate 3 wrong answers with AI. Uses your deck's name, description, and existing cards to match style and scope."
      : "Generate correct answer + 3 wrong answers with AI. Uses your deck's name, description, and existing cards to match style and scope.";

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
            setQuestionImageUrl(null);
            setQuestionImagePreview(null);
            if (imageFileInputRef.current) imageFileInputRef.current.value = "";
          }}
          altText="Question image preview"
        />
      </div>

      {/* Answers */}
      <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Answers
          </p>
          {hasAI && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<span />}>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleGenerate}
                    disabled={!question.trim() || isBusy}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isGenerating
                      ? "Generating…"
                      : correctFilled
                        ? "AI distractors"
                        : "AI generate"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-center">{aiTooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
          <Input
            id="mc-correct"
            value={correctAnswer}
            onChange={(e) => setCorrectAnswer(e.target.value)}
            disabled={isBusy}
            placeholder="The right answer"
            className="text-sm border-emerald-500/40 focus-visible:ring-emerald-500/30"
          />
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

        {hasAI && (
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Tip: type a question, then press <span className="font-medium">AI generate</span> to
            fill in the correct answer and 3 distractors. If you already typed the correct
            answer, AI will generate just the 3 wrong answers — staying in your deck&apos;s topic
            and matching the style of your existing cards.
          </p>
        )}
      </div>

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
            : isUploadingImage
              ? "Uploading…"
              : isGenerating || isRegeneratingDistractors
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
  trigger,
  isAtLimit = false,
  hasAI = false,
}: AddCardDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"standard" | "multiple_choice">("standard");

  if (isAtLimit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} />}>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
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
              variant="outline"
              className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4"
            />
          }
        >
          + Add Card
        </DialogTrigger>
      )}
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Add a new card</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Choose a card format: a classic question-and-answer card, or a multiple-choice card.
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
          value={tab}
          onValueChange={(v) => setTab(v as "standard" | "multiple_choice")}
          className="gap-3"
        >
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="standard">Standard</TabsTrigger>
            <TabsTrigger value="multiple_choice">Multiple Choice</TabsTrigger>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
