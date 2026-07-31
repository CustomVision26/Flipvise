"use client";

import * as React from "react";
import { Download, Loader2, Pencil } from "lucide-react";
import { updateEssayInstructionsAction } from "@/actions/essay";
import type {
  EssayGenerationResult,
  EssayOutlineItem,
} from "@/lib/essay-ai-schema";
import {
  formatEssayOutlineDisplay,
  normalizeEssayGenerationResult,
  syncEssaySectionsFromOutline,
} from "@/lib/essay-result-normalize";
import { downloadEssayDocumentDocx } from "@/lib/essay-document-docx";
import type { DocumentStudioMeta } from "@/lib/document-generation-studio";
import { buildCitedModelEssayView } from "@/lib/essay-model-citation-demo";
import { downloadEssayPromptPdf } from "@/lib/essay-prompt-pdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type EssayPromptInstructionsPanelProps = {
  documentId: number;
  title: string;
  result: EssayGenerationResult;
  documentStudio?: DocumentStudioMeta | null;
  wordCountTarget: number;
  readOnly: boolean;
  isOwner: boolean;
  modelEssayRevealed: boolean;
  onRevealModel: () => void;
  onUpdated: (next: { title: string; result: EssayGenerationResult }) => void;
};

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function vocabularyToText(
  items: EssayGenerationResult["vocabulary"],
): string {
  if (!items?.length) return "";
  return items.map((item) => `${item.term} — ${item.definition}`).join("\n");
}

function parseVocabulary(value: string) {
  return linesToList(value)
    .map((line) => {
      const parts = line.split(/\s+[—\-–]\s+/);
      if (parts.length < 2) return null;
      const term = parts[0]!.trim();
      const definition = parts.slice(1).join(" — ").trim();
      if (!term || !definition) return null;
      return { term, definition };
    })
    .filter((item): item is { term: string; definition: string } => item != null);
}

function rubricToText(items: EssayGenerationResult["rubric"]): string {
  if (!items?.length) return "";
  return items
    .map((item) => `${item.name} | ${item.maxPoints} | ${item.description}`)
    .join("\n");
}

function parseRubric(value: string) {
  return linesToList(value)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (parts.length < 3) return null;
      const name = parts[0]!;
      const maxPoints = Number(parts[1]);
      const description = parts.slice(2).join(" | ").trim();
      if (!name || !description || !Number.isFinite(maxPoints) || maxPoints < 1) {
        return null;
      }
      return { name, maxPoints: Math.round(maxPoints), description };
    })
    .filter(
      (
        item,
      ): item is { name: string; maxPoints: number; description: string } =>
        item != null,
    );
}

export function EssayPromptInstructionsPanel({
  documentId,
  title: initialTitle,
  result: initialResult,
  documentStudio = null,
  wordCountTarget,
  readOnly,
  isOwner,
  modelEssayRevealed,
  onRevealModel,
  onUpdated,
}: EssayPromptInstructionsPanelProps) {
  const canEdit = !readOnly && isOwner;
  const [isEditing, setIsEditing] = React.useState(false);
  const editable = canEdit && isEditing;
  const [title, setTitle] = React.useState(initialTitle);
  const [draft, setDraft] = React.useState(() =>
    normalizeEssayGenerationResult(initialResult),
  );
  const [vocabText, setVocabText] = React.useState(() =>
    vocabularyToText(initialResult.vocabulary),
  );
  const [rubricText, setRubricText] = React.useState(() =>
    rubricToText(initialResult.rubric),
  );
  const [saving, setSaving] = React.useState(false);
  const [pdfDownloading, setPdfDownloading] = React.useState(false);
  const [docxDownloading, setDocxDownloading] = React.useState(false);

  function resetFromProps() {
    const next = normalizeEssayGenerationResult(initialResult);
    setTitle(initialTitle);
    setDraft(next);
    setVocabText(vocabularyToText(next.vocabulary));
    setRubricText(rubricToText(next.rubric));
  }

  React.useEffect(() => {
    if (isEditing) return;
    resetFromProps();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- view mode tracks latest saved props
  }, [initialTitle, initialResult]);

  React.useEffect(() => {
    if (readOnly) setIsEditing(false);
  }, [readOnly]);

  function startEditing() {
    resetFromProps();
    setIsEditing(true);
  }

  function cancelEditing() {
    resetFromProps();
    setIsEditing(false);
  }

  // Compute during render (stable hook count; avoid useMemo after HMR churn).
  const citedModelView = buildCitedModelEssayView(draft, documentStudio);
  const modelSegments = citedModelView.segments.length
    ? citedModelView.segments
    : draft.modelEssay?.trim()
      ? [{ badge: "Introduction" as const, text: draft.modelEssay }]
      : [];

  function updateOutlineItem(
    index: number,
    patch: Partial<EssayOutlineItem>,
  ) {
    setDraft((prev) => {
      if (!prev.outline) return prev;
      const outline = prev.outline.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      );
      return { ...prev, outline };
    });
  }

  async function handleSave() {
    const learningObjectives = draft.learningObjectives
      .map((item) => item.trim())
      .filter(Boolean);
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!draft.prompt.trim()) {
      toast.error("Essay prompt is required.");
      return;
    }
    if (learningObjectives.length === 0) {
      toast.error("Add at least one learning objective.");
      return;
    }
    const checklist = draft.successChecklist
      .map((item) => item.trim())
      .filter(Boolean);
    if (checklist.length === 0) {
      toast.error("Add at least one success checklist item.");
      return;
    }

    setSaving(true);
    try {
      const vocabulary = parseVocabulary(vocabText);
      const rubric = parseRubric(rubricText);
      const nextResult = syncEssaySectionsFromOutline({
        ...draft,
        title: title.trim(),
        prompt: draft.prompt.trim(),
        thesis: draft.thesis?.trim() ? draft.thesis.trim() : null,
        learningObjectives,
        successChecklist: checklist,
        vocabulary: vocabulary.length > 0 ? vocabulary : null,
        rubric: rubric.length > 0 ? rubric : null,
        planningGuide: (() => {
          const lines = (draft.planningGuide ?? [])
            .map((s) => s.trim())
            .filter(Boolean);
          return lines.length > 0 ? lines : null;
        })(),
        references: (() => {
          const lines = (draft.references ?? [])
            .map((s) => s.trim())
            .filter(Boolean);
          return lines.length > 0 ? lines : null;
        })(),
        modelEssay: draft.modelEssay?.trim() ? draft.modelEssay.trim() : null,
      });
      const saved = await updateEssayInstructionsAction({
        documentId,
        title: title.trim(),
        result: nextResult,
      });
      setTitle(saved.title);
      setDraft(saved.result);
      setVocabText(vocabularyToText(saved.result.vocabulary));
      setRubricText(rubricToText(saved.result.rubric));
      onUpdated(saved);
      setIsEditing(false);
      toast.success("Instructions saved");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save instructions",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    setPdfDownloading(true);
    try {
      await downloadEssayPromptPdf({
        title,
        prompt: draft.prompt,
        result: draft,
        wordCountTarget,
        includeModelEssay: modelEssayRevealed || !isOwner,
        documentStudio,
      });
      toast.success("Prompt PDF ready");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not download prompt PDF",
      );
    } finally {
      setPdfDownloading(false);
    }
  }

  function handleDownloadDocx() {
    setDocxDownloading(true);
    try {
      downloadEssayDocumentDocx({
        title,
        prompt: draft.prompt,
        result: draft,
        wordCountTarget,
        includeModelEssay: modelEssayRevealed || !isOwner,
        documentStudio,
      });
      toast.success("Word document ready");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not download Word document",
      );
    } finally {
      setDocxDownloading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 border-b">
        {editable ? (
          <div className="min-w-0 w-full space-y-1.5">
            <Label htmlFor="essay-instructions-title">Title</Label>
            <Input
              id="essay-instructions-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={512}
              className="w-full"
            />
            <CardDescription>Essay prompt & instructions</CardDescription>
          </div>
        ) : (
          <div className="min-w-0 w-full space-y-1">
            <CardTitle className="text-lg break-words text-balance">
              {title}
            </CardTitle>
            <CardDescription>Essay prompt & instructions</CardDescription>
          </div>
        )}
        <div className="flex w-full flex-wrap gap-2">
          {canEdit && !isEditing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={startEditing}
            >
              <Pencil className="size-3.5" aria-hidden />
              Edit
            </Button>
          ) : null}
          {editable ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={cancelEditing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Save instructions
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pdfDownloading || docxDownloading || saving}
            onClick={() => void handleDownloadPdf()}
          >
            {pdfDownloading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Download PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pdfDownloading || docxDownloading || saving}
            onClick={() => handleDownloadDocx()}
          >
            {docxDownloading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
            Download DOCX
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {editable ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="essay-instructions-thesis">Thesis</Label>
              <Textarea
                id="essay-instructions-thesis"
                value={draft.thesis ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    thesis: e.target.value,
                  }))
                }
                rows={2}
                placeholder="Optional thesis statement"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="essay-instructions-prompt">Essay prompt</Label>
              <Textarea
                id="essay-instructions-prompt"
                value={draft.prompt}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, prompt: e.target.value }))
                }
                rows={5}
              />
            </div>
            <Separator />
            <div className="space-y-1.5">
              <Label htmlFor="essay-instructions-objectives">
                Learning objectives (one per line)
              </Label>
              <Textarea
                id="essay-instructions-objectives"
                value={draft.learningObjectives.join("\n")}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    learningObjectives: e.target.value.split("\n"),
                  }))
                }
                rows={4}
              />
            </div>
            {draft.outline && draft.outline.length > 0 ? (
              <div className="space-y-3">
                <p className="font-medium">Essay sections (outline)</p>
                {draft.outline.map((item, index) => (
                  <div
                    key={item.id}
                    className="space-y-2 rounded-md border border-border/60 p-3"
                  >
                    <Label htmlFor={`outline-title-${item.id}`}>
                      Section {index + 1} title
                    </Label>
                    <Input
                      id={`outline-title-${item.id}`}
                      value={item.title}
                      onChange={(e) =>
                        updateOutlineItem(index, { title: e.target.value })
                      }
                    />
                    <Label htmlFor={`outline-purpose-${item.id}`}>Purpose</Label>
                    <Textarea
                      id={`outline-purpose-${item.id}`}
                      value={item.purpose}
                      onChange={(e) =>
                        updateOutlineItem(index, { purpose: e.target.value })
                      }
                      rows={2}
                    />
                    <Label htmlFor={`outline-words-${item.id}`}>
                      Estimated words
                    </Label>
                    <Input
                      id={`outline-words-${item.id}`}
                      type="number"
                      min={0}
                      max={5000}
                      value={item.estimatedWords}
                      onChange={(e) =>
                        updateOutlineItem(index, {
                          estimatedWords: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="essay-instructions-vocab">
                Vocabulary (Term — definition, one per line)
              </Label>
              <Textarea
                id="essay-instructions-vocab"
                value={vocabText}
                onChange={(e) => setVocabText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="essay-instructions-planning">
                Planning guide (one per line)
              </Label>
              <Textarea
                id="essay-instructions-planning"
                value={(draft.planningGuide ?? []).join("\n")}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    planningGuide: e.target.value.split("\n"),
                  }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="essay-instructions-checklist">
                Success checklist (one per line)
              </Label>
              <Textarea
                id="essay-instructions-checklist"
                value={draft.successChecklist.join("\n")}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    successChecklist: e.target.value.split("\n"),
                  }))
                }
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="essay-instructions-rubric">
                Rubric (Name | points | description, one per line)
              </Label>
              <Textarea
                id="essay-instructions-rubric"
                value={rubricText}
                onChange={(e) => setRubricText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="essay-instructions-refs">
                References (one per line)
              </Label>
              <Textarea
                id="essay-instructions-refs"
                value={(draft.references ?? []).join("\n")}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    references: e.target.value.split("\n"),
                  }))
                }
                rows={3}
              />
            </div>
            {draft.modelEssay != null || modelEssayRevealed ? (
              <div className="space-y-1.5">
                <Label htmlFor="essay-instructions-model">Model essay</Label>
                {modelEssayRevealed || !isOwner ? (
                  <Textarea
                    id="essay-instructions-model"
                    value={draft.modelEssay ?? ""}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        modelEssay: e.target.value,
                      }))
                    }
                    rows={8}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onRevealModel}
                  >
                    Reveal model essay
                  </Button>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <>
            {draft.thesis ? (
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Thesis: </span>
                {draft.thesis}
              </p>
            ) : null}
            <p className="whitespace-pre-wrap text-foreground">{draft.prompt}</p>
            <Separator />
            <div>
              <p className="mb-1 font-medium">Learning objectives</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {draft.learningObjectives.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
            {draft.outline && draft.outline.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Essay sections (outline)</p>
                <ol className="list-none space-y-1 pl-0 text-muted-foreground">
                  {draft.outline.map((item, index) => (
                    <li key={item.id} className="text-foreground">
                      {formatEssayOutlineDisplay(item, index)}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
            {draft.vocabulary && draft.vocabulary.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Vocabulary</p>
                <ul className="space-y-1 text-muted-foreground">
                  {draft.vocabulary.map((v) => (
                    <li key={v.term}>
                      <span className="font-medium text-foreground">
                        {v.term}
                      </span>
                      {" — "}
                      {v.definition}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {draft.planningGuide && draft.planningGuide.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Planning guide</p>
                <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                  {draft.planningGuide.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            {draft.successChecklist.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Success checklist</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {draft.successChecklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {draft.rubric && draft.rubric.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">Rubric</p>
                <ul className="space-y-1 text-muted-foreground">
                  {draft.rubric.map((r) => (
                    <li key={r.name}>
                      <span className="font-medium text-foreground">
                        {r.name}
                      </span>{" "}
                      ({r.maxPoints} pts) — {r.description}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {draft.modelEssay ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">Model essay</p>
                  {citedModelView.showCitations ? (
                    <Badge variant="outline">
                      {citedModelView.styleLabel}
                    </Badge>
                  ) : null}
                </div>
                {citedModelView.showCitations ? (
                  <p className="text-xs text-muted-foreground">
                    {citedModelView.appliedDemo
                      ? `Client fallback citations were added because the model text had none. Regenerate with In-Text Citations enabled for full ${citedModelView.styleLabel} AI citations.`
                      : `${citedModelView.styleLabel} in-text citations below come from the AI model essay. Match this format in your own writing.`}
                  </p>
                ) : null}
                {modelEssayRevealed || !isOwner ? (
                  <div className="space-y-3">
                    {citedModelView.titlePage ? (
                      <div className="space-y-2 rounded-md border border-border/60 p-4 text-center">
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Title page
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {citedModelView.titlePage}
                        </p>
                      </div>
                    ) : null}
                    {modelSegments.map((segment) => (
                      <div
                        key={`${segment.badge}-${segment.title ?? ""}-${segment.text.slice(0, 24)}`}
                        className="space-y-2"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="shrink-0">
                            {segment.badge}
                          </Badge>
                          {segment.title &&
                          segment.title.toLowerCase() !==
                            segment.badge.toLowerCase() ? (
                            <span className="min-w-0 break-words text-xs text-muted-foreground">
                              {segment.title}
                            </span>
                          ) : null}
                        </div>
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {segment.text}
                        </p>
                        {segment.guidance ? (
                          <div className="rounded-md border border-border/70 bg-muted/40 px-3 py-2">
                            <p className="text-xs font-medium text-foreground">
                              Construction tip
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {segment.guidance.replace(
                                /^Construction tip\s*[—–-]\s*[^:]+:\s*/i,
                                "",
                              )}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {citedModelView.showCitations &&
                    citedModelView.references.length > 0 ? (
                      <div className="space-y-2 border-t border-border/60 pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {citedModelView.referencesTitle}
                          </p>
                          {citedModelView.referencesAreSamples ? (
                            <Badge variant="secondary">Sample references</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {citedModelView.referencesNote ||
                            `Formatted for ${citedModelView.styleLabel}.`}
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                          {citedModelView.references.map((ref) => (
                            <li key={ref}>{ref}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onRevealModel}
                  >
                    Reveal model essay
                  </Button>
                )}
              </div>
            ) : null}
            {!citedModelView.showCitations &&
            draft.references &&
            draft.references.length > 0 ? (
              <div>
                <p className="mb-1 font-medium">References</p>
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  {draft.references.map((ref) => (
                    <li key={ref}>{ref}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
