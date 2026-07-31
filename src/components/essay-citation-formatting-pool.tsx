"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import {
  applyEssayCitationFormatAction,
  extractEssayUserSourceAction,
  getEssayDocumentPdfDataAction,
} from "@/actions/essay";
import {
  ESSAY_CITATION_OPTIONS,
  type EssayCitationStyle,
} from "@/lib/essay-builder-options";
import { essayTypeLabel } from "@/lib/essay-ai-schema";
import type { EssayCitationFormatSource } from "@/lib/essay-citation-apply-schema";
import { citationStyleDisplayLabel } from "@/lib/essay-model-citation-demo";
import type { SubmittedEssayPoolItem } from "@/lib/essay-citation-formatting-pool";
import {
  buildFormattedWrittenEssayPreview,
  buildPreviewFromFormattedSnapshot,
  type FormattedWrittenEssayPreviewModel,
} from "@/lib/essay-apa-student-paper";
import { EssayFormattedPaperPreview } from "@/components/essay-formatted-paper-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export type { SubmittedEssayPoolItem };

const CITATION_SOURCE_OPTIONS: Array<{
  value: EssayCitationFormatSource;
  label: string;
  caption: string;
}> = [
  {
    value: "user_written",
    label: "User written essay",
    caption: "Copy the student’s draft and format that copy.",
  },
  {
    value: "model_essay",
    label: "Model essay",
    caption: "Copy the AI model essay and format that copy.",
  },
];

type EssayCitationFormattingPoolProps = {
  essays: SubmittedEssayPoolItem[];
  /** Pre-select this essay (e.g. Formatted papers → Edit). */
  initialEssayId?: number | null;
  /** Open the formatted preview in edit mode after load. */
  initialEditMode?: boolean;
};

export function EssayCitationFormattingPool({
  essays,
  initialEssayId = null,
  initialEditMode = false,
}: EssayCitationFormattingPoolProps) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const loadSeqRef = React.useRef(0);

  const resolvedInitialId =
    initialEssayId != null &&
    essays.some((essay) => essay.documentId === initialEssayId)
      ? initialEssayId
      : (essays[0]?.documentId ?? null);

  const [selectedId, setSelectedId] = React.useState<number | null>(
    resolvedInitialId,
  );
  const [citationStyle, setCitationStyle] =
    React.useState<EssayCitationStyle>(() => {
      const seed = essays.find((e) => e.documentId === resolvedInitialId);
      return seed?.currentCitationStyle !== "none" && seed?.currentCitationStyle
        ? seed.currentCitationStyle
        : "apa";
    });
  const [userSourcesText, setUserSourcesText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);
  const [loadingPreview, setLoadingPreview] = React.useState(
    () => initialEssayId != null,
  );
  const [preview, setPreview] =
    React.useState<FormattedWrittenEssayPreviewModel | null>(null);
  const [previewEditMode, setPreviewEditMode] = React.useState(false);
  const [sourceDialogOpen, setSourceDialogOpen] = React.useState(false);
  const [citationSource, setCitationSource] =
    React.useState<EssayCitationFormatSource>("user_written");

  const selected = essays.find((e) => e.documentId === selectedId) ?? null;

  const loadPreviewForDocument = React.useCallback(
    async (documentId: number, enterEditMode: boolean) => {
      const seq = ++loadSeqRef.current;
      setLoadingPreview(true);
      try {
        const payload = await getEssayDocumentPdfDataAction({ documentId });
        if (seq !== loadSeqRef.current) return;

        const formatting = payload.documentStudio?.essayFormatting;
        if (formatting?.citationStyle && formatting.citationStyle !== "none") {
          setCitationStyle(formatting.citationStyle);
        }
        setUserSourcesText(formatting?.userSourcesText ?? "");

        const snapshot = formatting?.formattedEssayPreview ?? null;
        if (snapshot) {
          setPreview(
            buildPreviewFromFormattedSnapshot({
              title: payload.title,
              citationStyle: formatting?.citationStyle ?? "apa",
              snapshot,
              indentFirstLine: formatting?.indentFirstLine,
            }),
          );
        } else {
          setPreview(
            buildFormattedWrittenEssayPreview({
              title: payload.title,
              result: payload.result,
              writtenSections: payload.writtenSections,
              documentStudio: payload.documentStudio,
              studentName: payload.studentName,
              institutionName: payload.institutionName,
              courseName: payload.courseName,
              instructorName: payload.instructorName,
              assignmentDate: payload.assignmentDate,
            }),
          );
        }
        setPreviewEditMode(enterEditMode);
      } catch (e) {
        if (seq !== loadSeqRef.current) return;
        setPreview(null);
        setPreviewEditMode(false);
        toast.error(
          e instanceof Error ? e.message : "Could not open formatted preview",
        );
      } finally {
        if (seq === loadSeqRef.current) setLoadingPreview(false);
      }
    },
    [],
  );

  // Formatted papers → Edit (or deep link): select essay and open preview in edit mode.
  React.useEffect(() => {
    if (initialEssayId == null) {
      setLoadingPreview(false);
      return;
    }
    if (!essays.some((essay) => essay.documentId === initialEssayId)) {
      setLoadingPreview(false);
      return;
    }
    setSelectedId(initialEssayId);
    void loadPreviewForDocument(initialEssayId, initialEditMode);
  }, [initialEssayId, initialEditMode, essays, loadPreviewForDocument]);

  function selectEssayFromPool(documentId: number) {
    if (documentId === selectedId) return;
    loadSeqRef.current += 1;
    setSelectedId(documentId);
    setPreview(null);
    setPreviewEditMode(false);
    setLoadingPreview(false);
    setUserSourcesText("");
    const next = essays.find((e) => e.documentId === documentId);
    if (next?.currentCitationStyle && next.currentCitationStyle !== "none") {
      setCitationStyle(next.currentCitationStyle);
    }
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setExtracting(true);
    try {
      const chunks: string[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.set("file", file);
        const extracted = await extractEssayUserSourceAction(formData);
        chunks.push(
          `--- ${extracted.sourceTitle || file.name} ---\n${extracted.text}`,
        );
      }
      setUserSourcesText((prev) =>
        [prev.trim(), ...chunks].filter(Boolean).join("\n\n").slice(0, 50_000),
      );
      toast.success("Source file(s) added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not extract source");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function openSourceDialog() {
    if (selectedId == null) {
      toast.error("Select an essay from the pool.");
      return;
    }
    if (citationStyle === "none") {
      toast.error("Choose APA, MLA, Chicago, or Harvard.");
      return;
    }
    setCitationSource("user_written");
    setSourceDialogOpen(true);
  }

  async function handleApply(source: EssayCitationFormatSource) {
    if (selectedId == null) {
      toast.error("Select an essay from the pool.");
      return;
    }
    if (citationStyle === "none") {
      toast.error("Choose APA, MLA, Chicago, or Harvard.");
      return;
    }
    setPending(true);
    try {
      const applied = await applyEssayCitationFormatAction({
        documentId: selectedId,
        citationStyle,
        source,
        userSourcesText,
      });
      const selectedEssay = essays.find((e) => e.documentId === selectedId);
      setPreview(
        buildPreviewFromFormattedSnapshot({
          title: selectedEssay?.title ?? "Untitled Essay",
          citationStyle: applied.citationStyle,
          snapshot: applied.preview,
          indentFirstLine: true,
        }),
      );
      setPreviewEditMode(false);
      setSourceDialogOpen(false);
      const sourceLabel =
        source === "model_essay" ? "model essay" : "user-written essay";
      toast.success(
        `Formatted a copy of the ${sourceLabel} with ${citationStyleDisplayLabel(citationStyle)} — original unchanged`,
      );
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not apply citation format",
      );
    } finally {
      setPending(false);
    }
  }

  if (essays.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No essays yet. Generate an essay under Essay Generator, then return here
        to choose a citation format.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-foreground">Essay pool</p>
          <p className="text-xs text-muted-foreground">
            Select an essay, then choose how it should be cited and formatted.
          </p>
        </div>
        <ul className="space-y-2">
          {essays.map((essay) => {
            const active = essay.documentId === selectedId;
            return (
              <li key={essay.documentId}>
                <button
                  type="button"
                  onClick={() => selectEssayFromPool(essay.documentId)}
                  className={
                    active
                      ? "w-full rounded-md border border-primary bg-primary/10 px-3 py-3 text-left text-sm"
                      : "w-full rounded-md border border-border/60 px-3 py-3 text-left text-sm transition-colors hover:bg-muted/40"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{essay.title}</p>
                    {essay.currentCitationStyle !== "none" ? (
                      <Badge variant="secondary">
                        {citationStyleDisplayLabel(essay.currentCitationStyle)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unformatted</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {essay.subject} · {essay.gradeLevel} ·{" "}
                    {essayTypeLabel(essay.essayType)} · {essay.wordCount} words
                  </p>
                  {essay.submittedAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Submitted{" "}
                      {new Date(essay.submittedAt).toLocaleString()}
                    </p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            Citation format
          </p>
          <p className="text-xs text-muted-foreground">
            {selected
              ? `Formatting “${selected.title}”`
              : "Select an essay from the pool"}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pool-citation-style">Citation style</Label>
          <Select
            value={citationStyle}
            onValueChange={(v) => {
              if (v != null) setCitationStyle(v as EssayCitationStyle);
            }}
          >
            <SelectTrigger id="pool-citation-style" className="w-full">
              <SelectValue placeholder="Select citation style">
                {(value) =>
                  value
                    ? citationStyleDisplayLabel(value as EssayCitationStyle)
                    : null
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ESSAY_CITATION_OPTIONS.filter((opt) => opt.value !== "none").map(
                (opt) => (
                  <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                    {opt.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pool-user-sources">Sources (optional)</Label>
          <p className="text-xs text-muted-foreground">
            Paste URLs or reference notes, or upload PDF / DOCX. Flipvise will
            insert matching in-text citations and build a References page from
            only the sources used in the essay. Leave empty to use sample
            demonstration references.
          </p>
          <Textarea
            id="pool-user-sources"
            value={userSourcesText}
            onChange={(e) => setUserSourcesText(e.target.value)}
            rows={5}
            placeholder="Paste sources here, one per block…"
            className="min-h-24"
          />
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              multiple
              className="sr-only"
              onChange={(e) => void onUploadFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={extracting || pending}
              onClick={() => fileRef.current?.click()}
            >
              {extracting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Extracting…
                </>
              ) : (
                <>
                  <Upload className="size-4" aria-hidden />
                  Import PDF / DOCX
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Choose Model essay or User written essay, copy that text, then apply
          paper defaults, in-text citations, and a synced References page on the
          copy. The original essay document is left unchanged. Preview appears
          below.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={pending || selectedId == null || extracting}
            onClick={openSourceDialog}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Building citations…
              </>
            ) : (
              "Apply citation format"
            )}
          </Button>
          {selectedId != null ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/dashboard/essay/${selectedId}`)}
            >
              Open essay
            </Button>
          ) : null}
        </div>

        {loadingPreview ? (
          <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Opening formatted preview…
          </div>
        ) : preview && selectedId != null ? (
          <div className="pt-2">
            <EssayFormattedPaperPreview
              key={`${selectedId}-edit-${previewEditMode ? "1" : "0"}`}
              preview={preview}
              documentId={selectedId}
              onPreviewChange={(next) => {
                setPreview(next);
                setPreviewEditMode(false);
              }}
              startInEditMode={previewEditMode}
            />
          </div>
        ) : (
          <p className="pt-1 text-xs text-muted-foreground">
            Apply a citation format to preview the formatted written essay with
            citations and References here.
          </p>
        )}
      </div>

      <Dialog
        open={sourceDialogOpen}
        onOpenChange={(open) => {
          if (pending) return;
          setSourceDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Choose essay to format</DialogTitle>
            <DialogDescription>
              A copy of your selection will be formatted with citations and
              references. The original draft and model essay stay unchanged.
            </DialogDescription>
          </DialogHeader>

          <RadioGroup
            value={citationSource}
            onValueChange={(value) => {
              if (value === "user_written" || value === "model_essay") {
                setCitationSource(value);
              }
            }}
            className="gap-3"
            aria-label="Essay source for citation formatting"
            disabled={pending}
          >
            {CITATION_SOURCE_OPTIONS.map((option) => {
              const id = `citation-source-${option.value}`;
              return (
                <div
                  key={option.value}
                  className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/10 px-3 py-2.5"
                >
                  <RadioGroupItem
                    value={option.value}
                    id={id}
                    aria-label={`${option.label}. ${option.caption}`}
                    className="mt-0.5"
                    disabled={pending}
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Label
                      htmlFor={id}
                      className="cursor-pointer text-sm font-medium text-foreground"
                    >
                      {option.label}
                    </Label>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {option.caption}
                    </p>
                  </div>
                </div>
              );
            })}
          </RadioGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setSourceDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => void handleApply(citationSource)}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Formatting copy…
                </>
              ) : (
                "Format selected copy"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
