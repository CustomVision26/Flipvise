"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HelpCircle, ImagePlus, Mic, Square } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createDeckAction } from "@/actions/decks";
import { createCardAction, uploadCardImageAction } from "@/actions/cards";
import { cn } from "@/lib/utils";

/** Minimal typings for browser Web Speech API (not in all TS lib.dom builds). */
interface DeckSpeechRecognitionAlternative {
  transcript: string;
}
interface DeckSpeechRecognitionEvent extends Event {
  readonly results: {
    readonly length: number;
    [index: number]: { 0: DeckSpeechRecognitionAlternative };
  };
}
interface DeckSpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((ev: DeckSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function getSpeechRecognitionCtor():
  | (new () => DeckSpeechRecognition)
  | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: new () => DeckSpeechRecognition;
    webkitSpeechRecognition?: new () => DeckSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface AddDeckDialogProps {
  triggerLabel?: string;
  /** Shown on hover when set (e.g. expands a short trigger label). */
  triggerTooltip?: string;
  isAtLimit?: boolean;
  /** When set, deck is created in this team workspace (subscriber or team admin). */
  teamId?: number;
  /**
   * Personal `/dashboard` — deck is always stored for the signed-in user with no `teamId`
   * (server ignores `teamId` even if set).
   */
  forPersonalWorkspace?: boolean;
  /**
   * Team dashboard or team workspace on `/dashboard` — deck must be a team deck
   * (subscriber `userId` + `teamId`); server refuses the personal path.
   */
  forTeamWorkspace?: boolean;
  /**
   * Clerk team-tier subscriber (e.g. pro_team_basic) — enables dictation on name/description
   * on the main dashboard create-deck dialog.
   */
  speechToTextEnabled?: boolean;
  /**
   * When true with `forTeamWorkspace`, allows an optional image that becomes the first card’s front.
   * Intended for team-tier subscribers on the main dashboard team workspace.
   */
  deckFrontImageUploadEnabled?: boolean;
}

export function AddDeckDialog({
  triggerLabel = "+ New Deck",
  triggerTooltip,
  isAtLimit = false,
  teamId,
  forPersonalWorkspace = false,
  forTeamWorkspace = false,
  speechToTextEnabled = false,
  deckFrontImageUploadEnabled = false,
}: AddDeckDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = React.useState(false);
  const [dictationField, setDictationField] = React.useState<"name" | "description" | null>(
    null,
  );
  const [frontImageFile, setFrontImageFile] = React.useState<File | null>(null);
  const [frontImagePreviewUrl, setFrontImagePreviewUrl] = React.useState<string | null>(null);

  const nameInputRef = React.useRef<HTMLInputElement>(null);
  const descriptionRef = React.useRef<HTMLTextAreaElement>(null);
  const recognitionRef = React.useRef<DeckSpeechRecognition | null>(null);

  const showSpeechUi = speechToTextEnabled && speechSupported;
  const showDeckFrontImage = deckFrontImageUploadEnabled && forTeamWorkspace;

  React.useEffect(() => {
    setSpeechSupported(getSpeechRecognitionCtor() !== undefined);
  }, []);

  React.useEffect(() => {
    if (!frontImageFile) {
      setFrontImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(frontImageFile);
    setFrontImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [frontImageFile]);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  function stopDictation() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setDictationField(null);
  }

  function appendToField(
    el: HTMLInputElement | HTMLTextAreaElement | null,
    text: string,
  ) {
    if (!el) return;
    const t = text.trim();
    if (!t) return;
    const cur = el.value;
    const spacer = cur.length > 0 && !/\s$/.test(cur) ? " " : "";
    el.value = `${cur}${spacer}${t}`;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function startDictation(field: "name" | "description") {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("Dictation is not supported in this browser.");
      return;
    }
    stopDictation();
    const rec = new Ctor();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    setDictationField(field);
    setError(null);
    rec.onresult = (ev: DeckSpeechRecognitionEvent) => {
      const el =
        field === "name" ? nameInputRef.current : descriptionRef.current;
      let chunk = "";
      for (let i = 0; i < ev.results.length; i++) {
        chunk += ev.results[i]?.[0]?.transcript ?? "";
      }
      appendToField(el, chunk);
    };
    rec.onerror = () => {
      setDictationField(null);
      recognitionRef.current = null;
    };
    rec.onend = () => {
      setDictationField(null);
      recognitionRef.current = null;
    };
    try {
      rec.start();
    } catch {
      setDictationField(null);
      recognitionRef.current = null;
      setError("Could not start dictation. Check microphone permission.");
    }
  }

  function onFrontImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      setFrontImageFile(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      setError("Image must be JPEG, PNG, WebP, or GIF.");
      setFrontImageFile(null);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image must be under 5 MB.");
      setFrontImageFile(null);
      return;
    }
    setFrontImageFile(file);
  }

  function resetDialogFormState() {
    setFrontImageFile(null);
    setFrontImagePreviewUrl(null);
    stopDictation();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const description = (
      form.elements.namedItem("description") as HTMLTextAreaElement
    ).value.trim();

    if (!name) {
      setError("Deck name is required.");
      return;
    }

    setIsPending(true);
    try {
      let deckId: number;
      if (forPersonalWorkspace) {
        const r = await createDeckAction({
          name,
          description: description || undefined,
          personalOnly: true,
        });
        deckId = r.deckId;
      } else if (forTeamWorkspace) {
        if (teamId === undefined) {
          setError("Team is required to create a team deck.");
          return;
        }
        const r = await createDeckAction({
          name,
          description: description || undefined,
          teamId,
          teamWorkspaceOnly: true,
        });
        deckId = r.deckId;
      } else {
        const r = await createDeckAction({
          name,
          description: description || undefined,
          ...(teamId !== undefined ? { teamId } : {}),
        });
        deckId = r.deckId;
      }

      if (showDeckFrontImage && frontImageFile) {
        const fd = new FormData();
        fd.append("image", frontImageFile);
        const url = await uploadCardImageAction({ deckId }, fd);
        await createCardAction({
          deckId,
          front: "",
          frontImageUrl: url,
          back: "Add the answer on this side",
        });
      }

      setOpen(false);
      form.reset();
      resetDialogFormState();
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
      if (!nextOpen) {
        setError(null);
        resetDialogFormState();
      }
    }
  }

  if (isAtLimit) {
    return (
      <Link href="/pricing" className={buttonVariants({ variant: "outline" })}>
        Upgrade to Pro for more decks
      </Link>
    );
  }

  const triggerButtonClass =
    "text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {triggerTooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <DialogTrigger
                  {...props}
                  render={
                    <Button
                      className={cn(triggerButtonClass, props.className)}
                    />
                  }
                >
                  {triggerLabel}
                </DialogTrigger>
              )}
            />
            <TooltipContent side="bottom">
              <p>{triggerTooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger render={<Button className={triggerButtonClass} />}>
          {triggerLabel}
        </DialogTrigger>
      )}
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Create a new deck</DialogTitle>
          <DialogDescription className="text-sm">
            Give your deck a name and an optional description.
            {showSpeechUi ? " Use the microphone to dictate into the fields." : ""}
            {showDeckFrontImage
              ? " Optionally add an image for the first card’s front (question side)."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <form id="add-deck-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deck-name">Name</Label>
                <Tooltip>
                  <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-semibold mb-1">Examples:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Mathematics</li>
                      <li>• Jamaica&apos;s History</li>
                      <li>• Spanish Vocabulary</li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={nameInputRef}
                  id="deck-name"
                  name="name"
                  placeholder="e.g. Spanish Vocabulary"
                  autoFocus
                  className="min-w-0 flex-1"
                />
                {showSpeechUi && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0"
                    disabled={isPending}
                    title={dictationField === "name" ? "Stop dictation" : "Dictate name"}
                    onClick={() =>
                      dictationField === "name" ? stopDictation() : startDictation("name")
                    }
                    aria-label={
                      dictationField === "name" ? "Stop dictating name" : "Dictate name"
                    }
                  >
                    {dictationField === "name" ? (
                      <Square className="size-3.5" />
                    ) : (
                      <Mic className="size-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="deck-description">Description (optional)</Label>
                <Tooltip>
                  <TooltipTrigger type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <HelpCircle className="h-4 w-4" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="font-semibold mb-1">Be specific to help AI understand:</p>
                    <ul className="space-y-1.5 text-xs">
                      <li>
                        <span className="font-medium">Mathematics</span>
                        <br />
                        → Algebra, Geometry, or Calculus
                      </li>
                      <li>
                        <span className="font-medium">Jamaica&apos;s History</span>
                        <br />
                        → Learning the 20th century history of Jamaica
                      </li>
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-2">
                <Textarea
                  ref={descriptionRef}
                  id="deck-description"
                  name="description"
                  placeholder="What would you like to learn?"
                  className="min-h-[88px] min-w-0 flex-1"
                />
                {showSpeechUi && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 self-start"
                    disabled={isPending}
                    title={
                      dictationField === "description"
                        ? "Stop dictation"
                        : "Dictate description"
                    }
                    onClick={() =>
                      dictationField === "description"
                        ? stopDictation()
                        : startDictation("description")
                    }
                    aria-label={
                      dictationField === "description"
                        ? "Stop dictating description"
                        : "Dictate description"
                    }
                  >
                    {dictationField === "description" ? (
                      <Square className="size-3.5" />
                    ) : (
                      <Mic className="size-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {showDeckFrontImage && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deck-front-image" className="flex items-center gap-2">
                  <ImagePlus className="size-4 text-muted-foreground" aria-hidden />
                  First card front image (optional)
                </Label>
                <Input
                  id="deck-front-image"
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(",")}
                  onChange={onFrontImageChange}
                  disabled={isPending}
                  className="cursor-pointer bg-background text-sm text-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm file:font-medium file:text-foreground"
                />
                {frontImagePreviewUrl && (
                  <div className="relative mt-1 overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user-selected local preview blob URL */}
                    <img
                      src={frontImagePreviewUrl}
                      alt="Selected front image preview"
                      className="max-h-40 w-full object-contain bg-muted/30"
                    />
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>
        </TooltipProvider>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>
            Cancel
          </DialogClose>
          <Button type="submit" form="add-deck-form" disabled={isPending}>
            {isPending ? "Creating…" : "Create Deck"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
