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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createCardAction, uploadCardImageAction, generateAnswerAction } from "@/actions/cards";
import { ImagePlus, X, Mic, MicOff, Sparkles } from "lucide-react";

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

export function AddCardDialog({ deckId, trigger, isAtLimit = false, hasAI = false }: AddCardDialogProps) {
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
  
  const [isRecordingFront, setIsRecordingFront] = useState(false);
  const [isRecordingBack, setIsRecordingBack] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  function startRecording(field: "front" | "back") {
    if (typeof window === "undefined") return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in your browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      if (field === "front") {
        setIsRecordingFront(true);
      } else {
        setIsRecordingBack(true);
      }
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      if (field === "front") {
        setFront((prev) => {
          const baseText = prev;
          if (finalTranscript) {
            return baseText + finalTranscript;
          }
          return baseText;
        });
      } else {
        setBack((prev) => {
          const baseText = prev;
          if (finalTranscript) {
            return baseText + finalTranscript;
          }
          return baseText;
        });
      }
    };

    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
      stopRecording();
    };

    recognition.onend = () => {
      setIsRecordingFront(false);
      setIsRecordingBack(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecordingFront(false);
    setIsRecordingBack(false);
  }

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  if (isAtLimit) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span tabIndex={0} />}>
            <Button variant="outline" size="sm" disabled className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4">
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
      stopRecording();
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
    
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const maxSize = 5 * 1024 * 1024;
    
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Only JPG, JPEG, PNG, WebP, and GIF images are allowed.");
      if (frontFileInputRef.current) frontFileInputRef.current.value = "";
      return;
    }
    
    if (file.size > maxSize) {
      setError("Image size must be 5MB or less.");
      if (frontFileInputRef.current) frontFileInputRef.current.value = "";
      return;
    }
    
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
    
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const maxSize = 5 * 1024 * 1024;
    
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Only JPG, JPEG, PNG, WebP, and GIF images are allowed.");
      if (backFileInputRef.current) backFileInputRef.current.value = "";
      return;
    }
    
    if (file.size > maxSize) {
      setError("Image size must be 5MB or less.");
      if (backFileInputRef.current) backFileInputRef.current.value = "";
      return;
    }
    
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
    stopRecording();
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

  async function handleGenerateAnswer() {
    if (!front.trim()) {
      setError("Please enter a question or term in the front field first.");
      return;
    }

    setError(null);
    setIsGeneratingAnswer(true);

    try {
      const answer = await generateAnswerAction({ deckId, question: front.trim() });
      setBack(answer);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate answer. Please try again.";
      setError(errorMessage);
    } finally {
      setIsGeneratingAnswer(false);
    }
  }

  const isUploading = isUploadingFront || isUploadingBack;
  const isBusy = isPending || isUploading || isGeneratingAnswer;
  const frontHasContent = front.trim().length > 0 || !!frontImageUrl;
  const backHasContent = back.trim().length > 0 || !!backImageUrl;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== undefined ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger render={<Button variant="outline" className="text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4" />}>
          + Add Card
        </DialogTrigger>
      )}
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Add a new card</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Each side of a card can have text or an image, or both — at least one is required per side.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 sm:gap-5 py-2">
          {/* Front */}
          <div className="flex flex-col gap-2 sm:gap-3 rounded-lg border border-border p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Front
            </p>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="front" className="text-xs sm:text-sm">Text <span className="text-muted-foreground font-normal">(question, term, etc.)</span></Label>
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
                        <TooltipContent>
                          {!front.trim() 
                            ? "Enter a question or term first" 
                            : "Generate answer with AI (validates relevance to deck topic)"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {speechSupported && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger render={<span />}>
                          <Button
                            type="button"
                            variant={isRecordingFront ? "destructive" : "outline"}
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => isRecordingFront ? stopRecording() : startRecording("front")}
                            disabled={isBusy || isRecordingBack}
                          >
                            {isRecordingFront ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isRecordingFront ? "Stop recording" : "Record with microphone"}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span className="w-full" />}>
                    <Textarea
                      id="front"
                      placeholder=""
                      value={front}
                      onChange={(e) => setFront(e.target.value)}
                      rows={3}
                      disabled={isBusy}
                      className="text-sm"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Enter a question or term for the front of flashcard
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
              onFileChange={handleFrontImageChange}
              onRemove={handleRemoveFrontImage}
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
                <Label htmlFor="back" className="text-xs sm:text-sm">Text <span className="text-muted-foreground font-normal">(answer, definition, etc.)</span></Label>
                {speechSupported && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger render={<span />}>
                        <Button
                          type="button"
                          variant={isRecordingBack ? "destructive" : "outline"}
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => isRecordingBack ? stopRecording() : startRecording("back")}
                          disabled={isBusy || isRecordingFront}
                        >
                          {isRecordingBack ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isRecordingBack ? "Stop recording" : "Record with microphone"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger render={<span className="w-full" />}>
                    <Textarea
                      id="back"
                      placeholder=""
                      value={back}
                      onChange={(e) => setBack(e.target.value)}
                      rows={3}
                      disabled={isBusy}
                      className="text-sm"
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Enter the answer, definition, or response for the back of flashcard
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
              onFileChange={handleBackImageChange}
              onRemove={handleRemoveBackImage}
              altText="Back image preview"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-destructive text-xs sm:text-sm">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
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
      </DialogContent>
    </Dialog>
  );
}
