"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import type { EssayCitationStyle } from "@/lib/essay-builder-options";
import { ESSAY_CITATION_OPTIONS } from "@/lib/essay-builder-options";
import {
  DOCUMENT_STUDIO_ALIGNMENTS,
  DOCUMENT_STUDIO_AI_DISCLOSURE,
  DOCUMENT_STUDIO_FONTS,
  DOCUMENT_STUDIO_FONT_SIZES,
  DOCUMENT_STUDIO_MARGINS,
  DOCUMENT_STUDIO_SPACING,
  type AcademicIntegrityMeta,
  type DocumentStudioSourceMode,
  type EssayFormattingMeta,
} from "@/lib/document-generation-studio";
import { formattingDefaultsForCitationStyle } from "@/lib/essay-citation-style-prompt";
import { extractEssayUserSourceAction } from "@/actions/essay";
import { acceptAttributeForFileSource } from "@/lib/source-import-formats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type EssayDocumentStudioPanelsProps = {
  formatting: EssayFormattingMeta;
  integrity: AcademicIntegrityMeta;
  onFormattingChange: (next: EssayFormattingMeta) => void;
  onIntegrityChange: (next: AcademicIntegrityMeta) => void;
  /** Keep legacy citationStyle / sourcesRequired in sync. */
  onLegacyCitationSync: (style: EssayCitationStyle, sourcesRequired: number) => void;
};

const SOURCE_MODE_OPTIONS: {
  value: DocumentStudioSourceMode;
  label: string;
  comingSoon?: boolean;
}[] = [
  { value: "none", label: "No Sources" },
  { value: "ai_generated", label: "AI Generated References" },
  { value: "user_supplied", label: "User Supplied Sources" },
  { value: "academic_search", label: "Academic Search", comingSoon: true },
];

const AI_DISCLOSURE_LABELS: Record<
  AcademicIntegrityMeta["aiDisclosure"],
  string
> = {
  none: "None",
  ai_assisted: "AI Assisted",
  ai_generated_draft: "AI Generated Draft",
  teacher_assisted: "Teacher Assisted",
};

const FUTURE_INTEGRITY_FEATURES = [
  "Plagiarism Checker",
  "AI Detection Score",
  "Citation Validation",
  "Grammar Verification",
  "Fact Verification",
] as const;

export function EssayDocumentStudioPanels({
  formatting,
  integrity,
  onFormattingChange,
  onIntegrityChange,
  onLegacyCitationSync,
}: EssayDocumentStudioPanelsProps) {
  const [studioTab, setStudioTab] = React.useState("citation-formatting");
  const [extracting, setExtracting] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const hasCitation = formatting.citationStyle !== "none";
  const showCitationReminder =
    hasCitation && !formatting.includeReferences;

  function patchFormatting(patch: Partial<EssayFormattingMeta>) {
    let next = { ...formatting, ...patch };
    if (patch.citationStyle != null) {
      next = formattingDefaultsForCitationStyle(patch.citationStyle, {
        ...formatting,
        ...patch,
      });
    }
    if (next.sourceMode === "academic_search") {
      next.sourceMode = "none";
    }
    onFormattingChange(next);
    const sourcesRequired =
      next.sourceMode === "ai_generated"
        ? Math.max(2, 3)
        : next.sourceMode === "user_supplied"
          ? Math.max(1, 2)
          : next.citationStyle !== "none" && next.includeReferences
            ? Math.max(2, 3)
            : 0;
    onLegacyCitationSync(next.citationStyle, sourcesRequired);
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
      patchFormatting({
        sourceMode: "user_supplied",
        userSourcesText: [formatting.userSourcesText.trim(), ...chunks]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 50_000),
      });
      toast.success("Source file(s) added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not extract source");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Document Studio options
        </p>
        <p className="text-xs text-muted-foreground">
          Citation style, formatting, and academic integrity for this essay.
        </p>
      </div>
      <Tabs
        value={studioTab}
        onValueChange={(value) => {
          if (value != null && value !== "") setStudioTab(String(value));
        }}
        className="w-full gap-3"
      >
        <TabsList
          variant="line"
          className="h-auto min-h-9 w-full flex-wrap justify-start gap-1 bg-transparent p-0"
        >
          <TabsTrigger
            value="citation-formatting"
            className="px-3 py-2 data-active:border-primary"
          >
            Citation & Formatting
          </TabsTrigger>
          <TabsTrigger
            value="academic-integrity"
            className="px-3 py-2 data-active:border-primary"
          >
            Academic Integrity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="citation-formatting" className="space-y-5 pt-2">
          <div className="space-y-3">
            <p className="text-sm font-medium">Citation Style</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ESSAY_CITATION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="studio-citation-style"
                    className="accent-primary"
                    checked={formatting.citationStyle === opt.value}
                    onChange={() =>
                      patchFormatting({ citationStyle: opt.value })
                    }
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            {formatting.citationStyle === "apa" ? (
              <p className="text-xs text-muted-foreground">
                APA 7th: AI will generate a title page, apply Times New Roman 12
                / double spacing / 1&quot; margins, insert parenthetical or
                narrative in-text citations in the model essay, and build a
                References page. Without user sources, references are clearly
                labeled as samples for formatting practice.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Include In-Text Citations</p>
              <p className="text-xs text-muted-foreground">
                Disabled when citation style is None.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formatting.includeInTextCitations}
                disabled={!hasCitation}
                onCheckedChange={(checked) =>
                  patchFormatting({ includeInTextCitations: checked === true })
                }
              />
              <span className="text-sm">
                {formatting.includeInTextCitations ? "Yes" : "No"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Generate References Page</p>
              <p className="text-xs text-muted-foreground">
                Auto-enabled for APA, MLA, Chicago, and Harvard.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formatting.includeReferences}
                disabled={!hasCitation}
                onCheckedChange={(checked) =>
                  patchFormatting({ includeReferences: checked === true })
                }
              />
              <span className="text-sm">
                {formatting.includeReferences ? "Yes" : "No"}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Source Mode</p>
            <div className="grid gap-2">
              {SOURCE_MODE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm ${
                    opt.comingSoon ? "opacity-60" : "cursor-pointer"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="studio-source-mode"
                      className="accent-primary"
                      disabled={opt.comingSoon}
                      checked={formatting.sourceMode === opt.value}
                      onChange={() => {
                        if (!opt.comingSoon) {
                          patchFormatting({ sourceMode: opt.value });
                        }
                      }}
                    />
                    {opt.label}
                  </span>
                  {opt.comingSoon ? (
                    <Badge variant="outline">Coming Soon</Badge>
                  ) : null}
                </label>
              ))}
            </div>
          </div>

          {formatting.sourceMode === "user_supplied" ? (
            <div className="space-y-3 rounded-md border border-border/60 p-3">
              <p className="text-sm font-medium">User Sources</p>
              <p className="text-xs text-muted-foreground">
                Paste URLs or references, or upload PDF / DOCX (existing Flipvise
                extractors).
              </p>
              <Textarea
                value={formatting.userSourcesText}
                onChange={(e) =>
                  patchFormatting({ userSourcesText: e.target.value })
                }
                rows={5}
                placeholder="Paste URLs or reference lines…"
              />
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                accept={[
                  acceptAttributeForFileSource("pdf"),
                  acceptAttributeForFileSource("docx"),
                ].join(",")}
                multiple
                onChange={(e) => void onUploadFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={extracting}
                onClick={() => fileRef.current?.click()}
              >
                {extracting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Upload PDF / DOCX
              </Button>
            </div>
          ) : null}

          <div className="space-y-3 rounded-md border border-border/60 p-3">
            <p className="text-sm font-medium">Formatting</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Font</Label>
                <Select
                  value={formatting.font}
                  onValueChange={(v) => {
                    if (v != null) {
                      patchFormatting({
                        font: v as EssayFormattingMeta["font"],
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_STUDIO_FONTS.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Font Size</Label>
                <Select
                  value={String(formatting.fontSize)}
                  onValueChange={(v) => {
                    if (v != null) {
                      patchFormatting({
                        fontSize: Number(v) as EssayFormattingMeta["fontSize"],
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_STUDIO_FONT_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Line Spacing</Label>
                <Select
                  value={String(formatting.lineSpacing)}
                  onValueChange={(v) => {
                    if (v != null) {
                      patchFormatting({
                        lineSpacing: Number(
                          v,
                        ) as EssayFormattingMeta["lineSpacing"],
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_STUDIO_SPACING.map((spacing) => (
                      <SelectItem key={spacing} value={String(spacing)}>
                        {spacing.toFixed(spacing % 1 === 0 ? 1 : 2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Alignment</Label>
                <Select
                  value={formatting.alignment}
                  onValueChange={(v) => {
                    if (v != null) {
                      patchFormatting({
                        alignment: v as EssayFormattingMeta["alignment"],
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_STUDIO_ALIGNMENTS.map((alignment) => (
                      <SelectItem key={alignment} value={alignment}>
                        {alignment === "left" ? "Left" : "Justified"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Margins</Label>
                <Select
                  value={formatting.margins}
                  onValueChange={(v) => {
                    if (v != null) {
                      patchFormatting({
                        margins: v as EssayFormattingMeta["margins"],
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_STUDIO_MARGINS.map((margin) => (
                      <SelectItem key={margin} value={margin}>
                        {margin[0]!.toUpperCase() + margin.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2">
                <Label htmlFor="studio-indent">Indent First Line</Label>
                <Switch
                  id="studio-indent"
                  checked={formatting.indentFirstLine}
                  onCheckedChange={(checked) =>
                    patchFormatting({ indentFirstLine: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2">
                <Label htmlFor="studio-page-numbers">Page Numbers</Label>
                <Switch
                  id="studio-page-numbers"
                  checked={formatting.pageNumbers}
                  onCheckedChange={(checked) =>
                    patchFormatting({ pageNumbers: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2">
                <Label htmlFor="studio-title-page">Title Page</Label>
                <Switch
                  id="studio-title-page"
                  checked={formatting.titlePage}
                  onCheckedChange={(checked) =>
                    patchFormatting({ titlePage: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border/40 px-3 py-2 sm:col-span-2">
                <div>
                  <Label htmlFor="studio-running-header">Running Header</Label>
                  <p className="text-xs text-muted-foreground">
                    Enabled when required by APA / MLA; available for other styles.
                  </p>
                </div>
                <Switch
                  id="studio-running-header"
                  checked={formatting.runningHeader}
                  disabled={!hasCitation}
                  onCheckedChange={(checked) =>
                    patchFormatting({ runningHeader: checked })
                  }
                />
              </div>
            </div>
          </div>
      </TabsContent>

      <TabsContent value="academic-integrity" className="space-y-4 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/60 p-3">
            <div>
              <p className="text-sm font-medium">Generate Original Content</p>
              <p className="text-xs text-muted-foreground">Originality preference</p>
            </div>
            <Switch
              checked={integrity.generateOriginalContent}
              onCheckedChange={(checked) =>
                onIntegrityChange({
                  ...integrity,
                  generateOriginalContent: checked,
                })
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label>AI Disclosure</Label>
            <Select
              value={integrity.aiDisclosure}
              onValueChange={(v) => {
                if (v != null) {
                  onIntegrityChange({
                    ...integrity,
                    aiDisclosure: v as AcademicIntegrityMeta["aiDisclosure"],
                  });
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_STUDIO_AI_DISCLOSURE.map((value) => (
                  <SelectItem key={value} value={value}>
                    {AI_DISCLOSURE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Plagiarism Reminder</p>
            <p>
              This document should be reviewed before submission. Users are
              responsible for verifying originality and complying with
              institutional academic integrity policies.
            </p>
          </div>

          {showCitationReminder ? (
            <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Citation Reminder</p>
              <p>
                Most academic institutions require a reference page when
                citations are used.
              </p>
            </div>
          ) : null}

          {formatting.sourceMode === "ai_generated" ? (
            <div className="rounded-md border border-border/60 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Source Verification</p>
              <p>
                AI-generated references may require manual verification before
                submission.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-medium">Future Features</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FUTURE_INTEGRITY_FEATURES.map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm opacity-60"
                >
                  <span>{label}</span>
                  <Badge variant="outline">Coming Soon</Badge>
                </div>
              ))}
            </div>
          </div>
      </TabsContent>
      </Tabs>
    </div>
  );
}
