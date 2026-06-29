"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  commitImportedCardsAction,
  generateCardsFromSourceAction,
} from "@/actions/cards";
import {
  generateCardsFromUploadFile,
  mapSourceImportNetworkError,
  type SourceImportProgress,
} from "@/lib/source-import-client";
import type { ImportedCardPreview } from "@/lib/source-import-types";
import { AI_GENERATION_CAP_PER_DECK } from "@/lib/deck-limits";
import {
  acceptAttributeForFileSource,
  fileSourcePickerHint,
  fileSourcePickerLabel,
  isFileSourceProPlusOnly,
  PRO_PLUS_SOURCE_FORMATS_ENABLED,
  type FileSourcePickerId,
  type SourcePickerId,
} from "@/lib/source-import-formats";
import { useOnlineStatus } from "@/lib/use-online-status";
import { getUnsupportedImportUrlReason } from "@/lib/source-import-url-validation";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  Camera,
  FileText,
  FileType,
  Link2,
  Presentation,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ReviewRow = ImportedCardPreview & {
  id: string;
  selected: boolean;
  /** AI-generated question — kept for quiz distractor generation after a front/back swap. */
  originalFront: string;
  /** AI-generated answer — paired with originalFront for quiz distractor generation. */
  originalBack: string;
};

interface FromSourceCardFormProps {
  deckId: number;
  hasAdvancedSourceImport: boolean;
  remainingAiSlots: number;
  remainingDeckSlots: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const FILE_SOURCE_OPTIONS: {
  id: FileSourcePickerId;
  icon: LucideIcon;
  proPlusKey?: keyof typeof PRO_PLUS_SOURCE_FORMATS_ENABLED;
}[] = [
  { id: "txt", icon: FileText },
  { id: "pdf", icon: FileType, proPlusKey: "pdf" },
  { id: "docx", icon: FileType, proPlusKey: "docx" },
  { id: "pptx", icon: Presentation, proPlusKey: "pptx" },
  { id: "handwriting_image", icon: Camera, proPlusKey: "handwriting_image" },
];

function maxGeneratableCount(remainingAiSlots: number, remainingDeckSlots: number): number {
  return Math.max(0, Math.min(remainingAiSlots, remainingDeckSlots, AI_GENERATION_CAP_PER_DECK));
}

function isFileSourceAvailable(
  id: FileSourcePickerId,
  hasAdvancedSourceImport: boolean,
): boolean {
  if (!isFileSourceProPlusOnly(id)) return true;
  if (!hasAdvancedSourceImport) return false;
  if (id === "txt") return true;
  return PRO_PLUS_SOURCE_FORMATS_ENABLED[id];
}

export function FromSourceCardForm({
  deckId,
  hasAdvancedSourceImport,
  remainingAiSlots,
  remainingDeckSlots,
  onSuccess,
  onCancel,
}: FromSourceCardFormProps) {
  const online = useOnlineStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<SourcePickerId | null>(null);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cardCount, setCardCount] = useState(5);
  const [reviewRows, setReviewRows] = useState<ReviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [relevanceWarning, setRelevanceWarning] = useState<string | null>(null);
  const [generateStep, setGenerateStep] = useState<SourceImportProgress | null>(null);
  const [isGenerating, startGenerate] = useTransition();
  const [isCommitting, startCommit] = useTransition();

  const maxCount = maxGeneratableCount(remainingAiSlots, remainingDeckSlots);
  const atQuota = maxCount === 0;

  useEffect(() => {
    if (maxCount > 0 && cardCount > maxCount) {
      setCardCount(maxCount);
    }
  }, [maxCount, cardCount]);

  const unsupportedUrlReason = useMemo(
    () => (sourceMode === "url" && url.trim() ? getUnsupportedImportUrlReason(url) : null),
    [sourceMode, url],
  );

  const isBusy = isGenerating || isCommitting;
  const hasSource =
    sourceMode === "url" ? Boolean(url.trim()) : sourceMode !== null && Boolean(file);
  const canGenerate =
    hasSource && !unsupportedUrlReason && !atQuota && online && !isBusy && sourceMode !== null;

  const selectedCount = reviewRows?.filter((r) => r.selected).length ?? 0;

  function clearSourceInput() {
    setUrl("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function selectSourceMode(mode: SourcePickerId) {
    if (sourceMode !== mode) {
      clearSourceInput();
    }
    setSourceMode(mode);
    setError(null);
    setRelevanceWarning(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setError(null);
    setRelevanceWarning(null);
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setError(null);
    setRelevanceWarning(null);
  }

  function handleGenerate(forceDespiteWarning = false) {
    setError(null);
    if (!forceDespiteWarning) setRelevanceWarning(null);
    startGenerate(async () => {
      try {
        setGenerateStep(null);
        const formData = new FormData();
        formData.set("deckId", String(deckId));
        formData.set("count", String(cardCount));
        if (forceDespiteWarning) {
          formData.set("skipRelevanceCheck", "true");
        }
        if (sourceMode === "url" && url.trim()) {
          formData.set("url", url.trim());
        } else if (file) {
          formData.set("file", file);
        } else {
          throw new Error("Choose a source type and provide a URL or file.");
        }

        const result =
          file != null
            ? await generateCardsFromUploadFile({
                deckId,
                count: cardCount,
                file,
                skipRelevanceCheck: forceDespiteWarning,
                onProgress: setGenerateStep,
              })
            : await generateCardsFromSourceAction(formData);

        setGenerateStep(null);

        if (result.status === "relevance_warning") {
          setRelevanceWarning(result.warning);
          return;
        }
        setRelevanceWarning(null);
        setReviewRows(
          result.cards.map((c, i) => ({
            ...c,
            id: `row-${i}-${Date.now()}`,
            selected: true,
            originalFront: c.front,
            originalBack: c.back,
          })),
        );
      } catch (err) {
        setGenerateStep(null);
        setReviewRows(null);
        setError(mapSourceImportNetworkError(err));
      }
    });
  }

  function handleCommit() {
    if (!reviewRows?.length) return;
    const selected = reviewRows.filter((r) => r.selected && r.front.trim() && r.back.trim());
    if (selected.length === 0) {
      setError("Select at least one card with front and back text.");
      return;
    }
    setError(null);
    startCommit(async () => {
      try {
        await commitImportedCardsAction({
          deckId,
          cards: selected.map((r) => ({
            front: r.front.trim(),
            back: r.back.trim(),
            distractorQuestion: r.originalFront.trim(),
            distractorAnswer: r.originalBack.trim(),
          })),
        });
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add cards. Please try again.");
      }
    });
  }

  function updateRow(id: string, patch: Partial<Pick<ReviewRow, "front" | "back" | "selected">>) {
    setReviewRows((rows) =>
      rows?.map((r) => (r.id === id ? { ...r, ...patch } : r)) ?? null,
    );
  }

  function swapRowFrontBack(id: string) {
    setReviewRows(
      (rows) =>
        rows?.map((r) => (r.id === id ? { ...r, front: r.back, back: r.front } : r)) ?? null,
    );
  }

  function renderSourceButton(
    id: SourcePickerId,
    label: string,
    icon: LucideIcon,
    locked: boolean,
  ) {
    const Icon = icon;
    const selected = sourceMode === id;
    const button = (
      <Button
        type="button"
        variant={selected ? "default" : "outline"}
        size="sm"
        disabled={isBusy || locked}
        onClick={() => !locked && selectSourceMode(id)}
        className={cn(
          "h-auto min-h-9 flex-col gap-1 px-2 py-2 text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:text-xs",
          locked && "opacity-50",
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="text-center sm:text-left">{label}</span>
      </Button>
    );

    if (!locked) return button;

    return (
      <Tooltip>
        <TooltipTrigger render={<span className="flex min-w-0 flex-1" />}>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p>Pro Plus feature.</p>
          <Link
            href="/pricing"
            className="mt-1 inline-block font-medium text-primary underline underline-offset-2"
          >
            View Pro Plus plans
          </Link>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (reviewRows) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Review AI-generated cards. Uncheck any you do not want, edit front or back, or use{" "}
          <span className="font-medium text-foreground">Swap</span> to flip question and answer on
          the card. Three quiz wrong answers are still generated from the original question when
          you save.
        </p>

        <div className="space-y-3 max-h-[min(50vh,22rem)] overflow-y-auto pr-1">
          {reviewRows.map((row, index) => (
            <div
              key={row.id}
              className={cn(
                "rounded-lg border p-3 space-y-2",
                row.selected ? "border-primary/40 bg-primary/5" : "border-border opacity-80",
              )}
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={row.selected}
                  onCheckedChange={(checked) =>
                    updateRow(row.id, { selected: checked === true })
                  }
                  aria-label={`Include card ${index + 1}`}
                />
                <span className="text-xs font-medium text-muted-foreground">Card {index + 1}</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Front
                </Label>
                <Textarea
                  value={row.front}
                  onChange={(e) => updateRow(row.id, { front: e.target.value })}
                  rows={2}
                  className="text-sm min-h-[2.5rem] resize-y"
                />
              </div>
              <div className="flex justify-center py-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => swapRowFrontBack(row.id)}
                  aria-label={`Swap front and back for card ${index + 1}`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Swap
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Back
                </Label>
                <Textarea
                  value={row.back}
                  onChange={(e) => updateRow(row.id, { back: e.target.value })}
                  rows={3}
                  className="text-sm min-h-[3rem] resize-y"
                />
              </div>
            </div>
          ))}
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={() => {
              setReviewRows(null);
              setError(null);
            }}
            className="w-full sm:w-auto"
          >
            Back
          </Button>
          <Button
            type="button"
            onClick={handleCommit}
            disabled={isBusy || selectedCount === 0}
            className="w-full sm:w-auto"
          >
            {isCommitting ? "Saving & generating quiz options…" : `Add ${selectedCount} selected`}
          </Button>
        </div>
      </div>
    );
  }

  const activeFileSource =
    sourceMode !== null && sourceMode !== "url" ? (sourceMode as FileSourcePickerId) : null;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose a source type, then add your material. AI reads it once to draft cards matched to
          your deck — nothing is stored. Wikipedia and articles work best for URLs.
        </p>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Source type</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div key="url" className="min-w-0">
              {renderSourceButton("url", "Website URL", Link2, false)}
            </div>
            {FILE_SOURCE_OPTIONS.map(({ id, icon }) => (
              <div key={id} className="min-w-0">
                {renderSourceButton(
                  id,
                  fileSourcePickerLabel(id),
                  icon,
                  !isFileSourceAvailable(id, hasAdvancedSourceImport),
                )}
              </div>
            ))}
          </div>
        </div>

        {sourceMode === "url" ? (
          <div className="space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3">
            <Label htmlFor="source-url" className="text-xs flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              Website URL
            </Label>
            <Input
              id="source-url"
              type="url"
              placeholder="https://en.wikipedia.org/wiki/..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              disabled={isBusy}
              className="text-sm"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Article and wiki pages work best. App store links are not supported.
            </p>
            {unsupportedUrlReason ? (
              <p className="text-xs text-amber-400 leading-relaxed" role="status">
                {unsupportedUrlReason}
              </p>
            ) : null}
          </div>
        ) : null}

        {activeFileSource ? (
          <div className="space-y-2 rounded-lg border border-border/80 bg-muted/10 p-3">
            <Label htmlFor="source-file" className="text-xs">
              Upload {fileSourcePickerLabel(activeFileSource).toLowerCase()} file
            </Label>
            <Input
              id="source-file"
              key={activeFileSource}
              ref={fileInputRef}
              type="file"
              accept={acceptAttributeForFileSource(activeFileSource)}
              onChange={handleFileChange}
              disabled={isBusy}
              className="text-sm file:mr-2 file:text-xs"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {fileSourcePickerHint(activeFileSource)}
            </p>
            {file ? (
              <p className="text-xs text-foreground truncate">
                Selected: <span className="font-medium">{file.name}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {sourceMode !== null ? (
          <div className="space-y-2">
            <Label htmlFor="source-count" className="text-xs">
              Cards to generate
            </Label>
            <Input
              id="source-count"
              type="number"
              min={1}
              max={maxCount || 1}
              value={cardCount}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setCardCount(Math.min(maxCount || 1, Math.max(1, n)));
              }}
              disabled={isBusy || atQuota}
              className="text-sm w-full sm:w-28"
            />
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {remainingAiSlots} AI slot{remainingAiSlots !== 1 ? "s" : ""} · {remainingDeckSlots}{" "}
              deck slot{remainingDeckSlots !== 1 ? "s" : ""} left
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Select a source type above to continue.
          </p>
        )}

        {relevanceWarning ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100"
          >
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <p className="leading-relaxed">{relevanceWarning}</p>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => setRelevanceWarning(null)}
                className="w-full sm:w-auto"
              >
                Change source
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isBusy}
                onClick={() => handleGenerate(true)}
                className="w-full sm:w-auto"
              >
                {isGenerating ? "Generating…" : "Generate anyway"}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isBusy}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleGenerate(false)}
            disabled={!canGenerate}
            className="w-full sm:w-auto gap-2"
          >
            <Sparkles className="h-4 w-4" />
            {isGenerating
              ? generateStep === "reading"
                ? "Reading file…"
                : generateStep === "generating"
                  ? "Generating cards…"
                  : "Generating…"
              : "Generate for review"}
          </Button>
        </div>

        {!online ? (
          <p className="text-xs text-muted-foreground">Reconnect to use AI import.</p>
        ) : atQuota ? (
          <p className="text-xs text-muted-foreground">
            No room left for more AI cards in this deck. Delete cards or upgrade your plan.
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
