"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Camera, FileText, FileType, Link2, Loader2, Plus, Presentation, X } from "lucide-react";
import { extractLessonPlanReferenceAction } from "@/actions/teacher-lesson-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeacherReviewFieldLabel } from "@/components/teacher-field-label";
import {
  acceptAttributeForFileSource,
  acceptAttributeForUpload,
  fileSourcePickerHint,
  fileSourcePickerLabel,
  isFileSourceProPlusOnly,
  PRO_PLUS_SOURCE_FORMATS_ENABLED,
  type FileSourcePickerId,
  type SourcePickerId,
} from "@/lib/source-import-formats";
import { getUnsupportedImportUrlReason } from "@/lib/source-import-url-validation";
import {
  MAX_LESSON_PLAN_REFERENCES,
  normalizeLessonPlanReferenceMaterial,
  type LessonPlanReferenceMaterial,
} from "@/lib/lesson-plan-reference-material";
import { isYouTubeUrl } from "@/lib/youtube-url";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type { LessonPlanReferenceMaterial };

export type LessonPlanReferenceMaterialFieldsHandle = {
  resolveReferences: () => Promise<LessonPlanReferenceMaterial[]>;
};

type LessonPlanReferenceMaterialFieldsProps = {
  hasAdvancedSourceImport: boolean;
  disabled?: boolean;
  value: LessonPlanReferenceMaterial[];
  onChange: (value: LessonPlanReferenceMaterial[]) => void;
  onError: (message: string | null) => void;
};

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

function isFileSourceAvailable(
  id: FileSourcePickerId,
  hasAdvancedSourceImport: boolean,
): boolean {
  if (!isFileSourceProPlusOnly(id)) return true;
  if (!hasAdvancedSourceImport) return false;
  if (id === "txt") return true;
  return PRO_PLUS_SOURCE_FORMATS_ENABLED[id];
}

function resetSourcePickerState(
  setSourceMode: (value: SourcePickerId | null) => void,
  setUrl: (value: string) => void,
  setSelectedFile: (value: File | null) => void,
  fileInputRef: React.RefObject<HTMLInputElement | null>,
) {
  setSourceMode(null);
  setUrl("");
  setSelectedFile(null);
  if (fileInputRef.current) fileInputRef.current.value = "";
}

export const LessonPlanReferenceMaterialFields = forwardRef<
  LessonPlanReferenceMaterialFieldsHandle,
  LessonPlanReferenceMaterialFieldsProps
>(function LessonPlanReferenceMaterialFields(
  {
    hasAdvancedSourceImport,
    disabled = false,
    value,
    onChange,
    onError,
  },
  ref,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastExtractErrorRef = useRef<string | null>(null);
  const [sourceMode, setSourceMode] = useState<SourcePickerId | null>(null);
  const [url, setUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const activeFileSource =
    sourceMode !== null && sourceMode !== "url" ? (sourceMode as FileSourcePickerId) : null;
  const unsupportedUrlReason = url.trim()
    ? getUnsupportedImportUrlReason(url.trim())
    : null;
  const atReferenceLimit = value.length >= MAX_LESSON_PLAN_REFERENCES;
  const canAddMore = !atReferenceLimit && !disabled && !isExtracting;

  function removeReference(index: number) {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
    onError(null);
  }

  async function extractAndAppendReference(nextUrl: string, nextFile: File | null) {
    if (atReferenceLimit) {
      const message = `You can add up to ${MAX_LESSON_PLAN_REFERENCES} references.`;
      lastExtractErrorRef.current = message;
      onError(message);
      return null;
    }

    lastExtractErrorRef.current = null;
    onError(null);
    setIsExtracting(true);
    try {
      const formData = new FormData();
      if (nextUrl.trim()) {
        formData.set("url", nextUrl.trim());
      } else if (nextFile) {
        formData.set("file", nextFile);
      } else {
        return null;
      }

      const extracted = await extractLessonPlanReferenceAction(formData);
      const material = normalizeLessonPlanReferenceMaterial({
        text: extracted.text,
        summary: extracted.summary,
      });
      onChange([...value, material]);
      resetSourcePickerState(setSourceMode, setUrl, setSelectedFile, fileInputRef);
      return material;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not read that reference material. Try another source.";
      lastExtractErrorRef.current = message;
      onError(message);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return null;
    } finally {
      setIsExtracting(false);
    }
  }

  useImperativeHandle(ref, () => ({
    async resolveReferences() {
      const references = [...value];

      if (url.trim() || selectedFile) {
        const material = await extractAndAppendReference(url, selectedFile);
        if (!material) {
          throw new Error(
            lastExtractErrorRef.current ??
              "Finish adding the pending reference, or clear the URL/file before generating.",
          );
        }
        references.push(material);
      }

      return references;
    },
  }));

  function handleSelectSource(id: SourcePickerId) {
    if (!canAddMore) return;
    if (sourceMode === id) {
      setSourceMode(null);
      return;
    }
    setSourceMode(id);
    onError(null);
    if (id === "url") {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setUrl("");
    }
  }

  function handleUrlChange(nextUrl: string) {
    setUrl(nextUrl);
    onError(null);
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    onError(null);
    if (file) {
      void extractAndAppendReference("", file);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-muted/10 p-3 sm:p-4 sm:col-span-2">
      <TeacherReviewFieldLabel
        label="Reference material (optional)"
        className="text-xs normal-case tracking-normal text-foreground"
        help={
          <>
            <p className="mb-2">
              Add one or more websites, documents, or images so the AI focuses on
              content you care about when building the lesson plan.
            </p>
            <p className="mb-1 font-semibold">Supported sources:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>YouTube URL — uses the video captions when available</li>
              <li>Public website URL (articles, Wikipedia, curriculum pages)</li>
              <li>Plain text (.txt)</li>
              <li>PDF, Word (.docx), PowerPoint (.pptx), or photo of notes</li>
            </ul>
            <p className="mt-2">
              You can add up to {MAX_LESSON_PLAN_REFERENCES} references. Files are
              read once and not stored. Leave blank to generate from the form fields
              only.
            </p>
          </>
        }
      />

      {value.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">
              Added references ({value.length}/{MAX_LESSON_PLAN_REFERENCES})
            </p>
          </div>
          <ul className="space-y-2">
            {value.map((reference, index) => (
              <li
                key={`reference-${index}`}
                className="flex items-start justify-between gap-2 rounded-md border border-border bg-background/80 px-3 py-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium text-foreground">
                    Reference {index + 1}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {reference.summary}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={() => removeReference(index)}
                  disabled={disabled || isExtracting}
                  aria-label={`Remove reference ${index + 1}`}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canAddMore ? (
        <div className="space-y-3 rounded-md border border-dashed border-border/70 bg-background/40 p-3">
          <div className="flex items-center gap-2">
            <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <Label className="text-xs font-medium text-foreground">
              {value.length === 0 ? "Add a reference" : "Add another reference"}
            </Label>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Source type</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant={sourceMode === "url" ? "default" : "outline"}
                className={cn(
                  "h-auto min-h-10 justify-start gap-2 px-3 py-2 text-left text-xs whitespace-normal",
                  sourceMode !== "url" && "text-foreground",
                )}
                onClick={() => handleSelectSource("url")}
                disabled={!canAddMore}
              >
                <Link2 className="size-4 shrink-0" aria-hidden />
                Website URL
              </Button>
              {FILE_SOURCE_OPTIONS.map(({ id, icon: Icon }) => {
                const locked = !isFileSourceAvailable(id, hasAdvancedSourceImport);
                return (
                  <Button
                    key={id}
                    type="button"
                    variant={sourceMode === id ? "default" : "outline"}
                    className={cn(
                      "h-auto min-h-10 justify-start gap-2 px-3 py-2 text-left text-xs whitespace-normal",
                      sourceMode !== id && "text-foreground",
                      locked && "opacity-50",
                    )}
                    onClick={() => !locked && handleSelectSource(id)}
                    disabled={!canAddMore || locked}
                    title={
                      locked ? "Requires Pro Plus or an education team workspace" : undefined
                    }
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {fileSourcePickerLabel(id)}
                  </Button>
                );
              })}
            </div>
          </div>

          {sourceMode === "url" ? (
            <div className="space-y-2">
              <Label htmlFor="lesson-reference-url" className="text-xs flex items-center gap-1.5">
                <Link2 className="size-3.5" aria-hidden />
                Website URL
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="lesson-reference-url"
                  type="url"
                  placeholder="https://en.wikipedia.org/wiki/..."
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  disabled={!canAddMore}
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={
                    !canAddMore || !url.trim() || Boolean(unsupportedUrlReason)
                  }
                  onClick={() => void extractAndAppendReference(url, null)}
                >
                  {isExtracting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Add URL"
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isYouTubeUrl(url)
                  ? "YouTube links use the video captions (manual or auto-generated) when available."
                  : "Article and curriculum pages work best."}
              </p>
              {unsupportedUrlReason ? (
                <p className="text-xs text-amber-400 leading-relaxed" role="status">
                  {unsupportedUrlReason}
                </p>
              ) : null}
            </div>
          ) : null}

          {activeFileSource ? (
            <div className="space-y-2">
              <Label className="text-xs">{fileSourcePickerLabel(activeFileSource)}</Label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {fileSourcePickerHint(activeFileSource)}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  activeFileSource === "txt"
                    ? acceptAttributeForFileSource(activeFileSource)
                    : acceptAttributeForUpload(hasAdvancedSourceImport)
                }
                className="hidden"
                disabled={!canAddMore}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  handleFileChange(file);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canAddMore}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isExtracting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    "Choose file"
                  )}
                </Button>
                {selectedFile ? (
                  <span className="text-xs text-muted-foreground truncate max-w-full">
                    {selectedFile.name}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Maximum of {MAX_LESSON_PLAN_REFERENCES} references reached. Remove one to
          add a different source.
        </p>
      )}
    </div>
  );
});
