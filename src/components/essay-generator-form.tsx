"use client";

import * as React from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Loader2 } from "lucide-react";
import { generateEssayAction } from "@/actions/essay";
import type { EssayGenerateInput } from "@/lib/essay-ai-schema";
import {
  ESSAY_TYPES,
  essayStanceOptions,
  essayTypeSupportsStance,
  type EssayStance,
  type EssayType,
} from "@/lib/essay-ai-schema";
import {
  ESSAY_ACCOMMODATION_OPTIONS,
  ESSAY_CITATION_OPTIONS,
  ESSAY_COMPLEXITY_OPTIONS,
  ESSAY_LENGTH_OPTIONS,
  ESSAY_TONE_OPTIONS,
  ESSAY_WORD_COUNT_OPTIONS,
  ESSAY_WRITING_STYLE_OPTIONS,
  recommendedWordCountForGrade,
  type EssayAccommodation,
  type EssayCitationStyle,
  type EssayComplexity,
  type EssayLength,
  type EssayTone,
  type EssayWordCountPreset,
  type EssayWritingStyle,
} from "@/lib/essay-builder-options";
import {
  defaultAcademicIntegrity,
  defaultEssayFormatting,
} from "@/lib/document-generation-studio";
import {
  ESSAY_CATALOG_SUBJECTS,
  ESSAY_SUBJECT_GROUPS,
} from "@/lib/essay-subjects";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const ESSAY_GRADE_OPTIONS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Year 1",
  "Year 2",
  "Undergraduate",
] as const;

/** Resolve a select option label so the trigger never shows raw values like side_1. */
function optionLabel(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: unknown,
): string | null {
  if (value == null || value === "") return null;
  const key = String(value);
  return options.find((opt) => opt.value === key)?.label ?? key;
}

export function EssayGeneratorForm({
  initialPrefill = null,
  prefillSourceTitle = null,
}: {
  initialPrefill?: Partial<EssayGenerateInput> | null;
  prefillSourceTitle?: string | null;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [subject, setSubject] = React.useState(initialPrefill?.subject ?? "");
  const [subjectPick, setSubjectPick] = React.useState(
    initialPrefill?.subject &&
      ESSAY_CATALOG_SUBJECTS.includes(
        initialPrefill.subject as (typeof ESSAY_CATALOG_SUBJECTS)[number],
      )
      ? initialPrefill.subject
      : "",
  );
  const [gradeLevel, setGradeLevel] = React.useState(
    initialPrefill?.gradeLevel ?? "",
  );
  const [essayType, setEssayType] = React.useState<EssayType>(
    initialPrefill?.essayType ?? "narrative",
  );
  const [essayStance, setEssayStance] = React.useState<EssayStance>(
    initialPrefill?.essayStance ?? "both",
  );
  const showStance = essayTypeSupportsStance(essayType);
  const stanceChoices = essayStanceOptions(essayType);

  const [topic, setTopic] = React.useState(initialPrefill?.topic ?? "");
  const [essayLength, setEssayLength] = React.useState<EssayLength>(
    initialPrefill?.essayLength ?? "ai_recommended",
  );
  const [customMainPoints, setCustomMainPoints] = React.useState(
    initialPrefill?.customMainPoints ?? 5,
  );
  const [complexity, setComplexity] = React.useState<EssayComplexity>(
    initialPrefill?.complexity ?? "ai_recommended",
  );
  const [wordCountPreset, setWordCountPreset] =
    React.useState<EssayWordCountPreset>(
      initialPrefill?.wordCountPreset ?? "ai_recommended",
    );
  const [customWordCount, setCustomWordCount] = React.useState(
    initialPrefill?.wordCount ?? 500,
  );
  const [writingStyle, setWritingStyle] = React.useState<EssayWritingStyle>(
    initialPrefill?.writingStyle ?? "academic",
  );
  const [tone, setTone] = React.useState<EssayTone>(
    initialPrefill?.tone ?? "neutral",
  );
  const [includeCounterargument, setIncludeCounterargument] = React.useState(
    initialPrefill?.includeCounterargument ?? false,
  );
  const [citationStyle, setCitationStyle] = React.useState<EssayCitationStyle>(
    initialPrefill?.citationStyle ?? "none",
  );
  const [sourcesRequired, setSourcesRequired] = React.useState(
    initialPrefill?.sourcesRequired ?? 0,
  );
  const [learningStandard, setLearningStandard] = React.useState(
    initialPrefill?.learningStandard ?? "",
  );
  const [accommodations, setAccommodations] = React.useState<
    EssayAccommodation[]
  >(initialPrefill?.accommodations ?? []);
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState(
    initialPrefill?.timeLimitMinutes ?? 0,
  );
  const [includeVocabulary, setIncludeVocabulary] = React.useState(
    initialPrefill?.includeVocabulary ?? true,
  );
  const [includeOutline, setIncludeOutline] = React.useState(
    initialPrefill?.includeOutline ?? true,
  );
  const [includeRubric, setIncludeRubric] = React.useState(
    initialPrefill?.includeRubric ?? true,
  );
  const [includeModelEssay, setIncludeModelEssay] = React.useState(
    initialPrefill?.includeModelEssay ?? true,
  );

  function toggleAccommodation(value: EssayAccommodation, on: boolean) {
    setAccommodations((prev) =>
      on ? [...new Set([...prev, value])] : prev.filter((a) => a !== value),
    );
  }

  function resolveWordCount(): number {
    if (wordCountPreset === "ai_recommended") {
      return recommendedWordCountForGrade(gradeLevel || "Grade 7");
    }
    if (wordCountPreset === "custom") {
      return customWordCount;
    }
    return Number(wordCountPreset);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!gradeLevel) {
      setError("Please select a grade.");
      return;
    }
    if (!subject.trim()) {
      setError("Please select or enter a subject.");
      return;
    }
    if (showStance && !essayStance) {
      setError(
        "Please choose both sides, side 1, or side 2 for this essay type.",
      );
      return;
    }
    setPending(true);
    try {
      await generateEssayAction({
        subject,
        gradeLevel,
        essayType,
        essayStance: showStance ? essayStance : null,
        topic,
        learningStandard,
        essayLength,
        customMainPoints,
        complexity,
        wordCountPreset,
        wordCount: resolveWordCount(),
        writingStyle,
        tone,
        includeCounterargument: showStance ? false : includeCounterargument,
        citationStyle,
        sourcesRequired,
        accommodations,
        timeLimitMinutes,
        includeVocabulary,
        includeOutline,
        includeRubric,
        includeModelEssay,
        documentStudio: {
          documentType: "essay",
          essayFormatting: defaultEssayFormatting(citationStyle),
          academicIntegrity: defaultAcademicIntegrity(),
        },
      });
    } catch (err) {
      // Server Action redirect() throws a special Next.js error — rethrow it.
      if (isRedirectError(err)) throw err;
      setError(err instanceof Error ? err.message : "Generation failed.");
      setPending(false);
    }
  }

  const showCustomSubject =
    subjectPick === "Other" ||
    (!!subject.trim() && !ESSAY_CATALOG_SUBJECTS.includes(subject));

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="space-y-1">
          <CardTitle>Essay Generator</CardTitle>
          <CardDescription>
            Set up a writing activity, then generate a prompt, outline,
            vocabulary, and rubric students can use.
          </CardDescription>
        </div>
        {initialPrefill ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-foreground">
            <p className="font-medium">Ready to update the topic</p>
            <p className="mt-0.5 text-muted-foreground">
              Fields were filled from{" "}
              <span className="text-foreground">
                {prefillSourceTitle?.trim() ||
                  initialPrefill.topic ||
                  "your essay"}
              </span>
              . Edit anything that should change, then generate a new activity
              that matches what students should write about.
            </p>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-8"
        >
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Basics
              </h3>
              <p className="text-xs text-muted-foreground">
                Subject, grade, and essay type for this activity.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-subject-select"
              label="Subject"
              help={
                <>
                  <p className="mb-1 font-semibold">Pick from the catalog</p>
                  <p>
                    Writing activities work across subjects—not English only.
                    Choose a listed subject, or choose Other to type a custom
                    one.
                  </p>
                </>
              }
            />
            <Select
              value={
                showCustomSubject && subjectPick !== "Other"
                  ? "Other"
                  : subjectPick
              }
              onValueChange={(v) => {
                const next = v ?? "";
                setSubjectPick(next);
                if (!next || next === "Other") {
                  if (next === "Other" && ESSAY_CATALOG_SUBJECTS.includes(subject)) {
                    setSubject("");
                  }
                  return;
                }
                setSubject(next);
              }}
            >
              <SelectTrigger id="essay-subject-select" className="w-full">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {ESSAY_SUBJECT_GROUPS.map((group) =>
                  group.subjects.length > 0 ? (
                    <SelectGroup key={group.category}>
                      <SelectLabel>{group.category}</SelectLabel>
                      {group.subjects.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : (
                    <SelectItem key={group.category} value={group.category}>
                      {group.category}
                    </SelectItem>
                  ),
                )}
                <SelectItem value="Other">Other (custom)</SelectItem>
              </SelectContent>
            </Select>
            {showCustomSubject ? (
              <Input
                id="essay-subject"
                placeholder="Type your custom subject"
                value={subject}
                onChange={(e) => {
                  const next = e.target.value;
                  setSubject(next);
                  if (ESSAY_CATALOG_SUBJECTS.includes(next)) {
                    setSubjectPick(next);
                  } else {
                    setSubjectPick("Other");
                  }
                }}
                maxLength={255}
                aria-required
              />
            ) : null}
          </div>

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-grade"
              label="Grade"
              help={
                <>
                  <p className="mb-1 font-semibold">Choose the learner level:</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>Primary: Grade 1–Grade 6</li>
                    <li>Secondary: Grade 7–Grade 12</li>
                    <li>Tertiary: Year 1, Year 2, Undergraduate</li>
                  </ul>
                </>
              }
            />
            <Select
              value={gradeLevel}
              onValueChange={(v) => setGradeLevel(v ?? "")}
            >
              <SelectTrigger id="essay-grade" aria-required>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {ESSAY_GRADE_OPTIONS.map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-type"
              label="Essay Type"
              help={
                <>
                  <p className="mb-1 font-semibold">Choose the writing mode</p>
                  <p>
                    Each type changes how the AI builds the prompt, outline,
                    rubric, and model response.
                  </p>
                </>
              }
            />
            <Select
              value={essayType}
              items={ESSAY_TYPES}
              onValueChange={(v) => {
                if (v == null) return;
                const next = v as EssayType;
                setEssayType(next);
                if (essayTypeSupportsStance(next)) {
                  setEssayStance("both");
                  setIncludeCounterargument(false);
                }
              }}
            >
              <SelectTrigger id="essay-type" className="w-full">
                <SelectValue placeholder="Select essay type">
                  {(value) => optionLabel(ESSAY_TYPES, value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {ESSAY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} label={t.label}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showStance ? (
            <div className="space-y-2">
              <TeacherFieldLabel
                htmlFor="essay-stance"
                label="Stance / Focus"
                help={
                  <>
                    <p className="mb-1 font-semibold">Two-sided writing</p>
                    <p>
                      Choose both sides, or focus on side 1 or side 2. The AI
                      constructs the activity for that choice.
                    </p>
                  </>
                }
              />
              <Select
                value={essayStance}
                items={stanceChoices}
                onValueChange={(v) => {
                  if (v != null) setEssayStance(v as EssayStance);
                }}
              >
                <SelectTrigger id="essay-stance" className="w-full">
                  <SelectValue placeholder="Select stance">
                    {(value) => optionLabel(stanceChoices, value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {stanceChoices.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      label={opt.label}
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">Topic</h3>
              <p className="text-xs text-muted-foreground">
                What students should write about — keep this aligned with their
                draft.
              </p>
            </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-topic"
              label="Essay Topic"
              help={
                <>
                  <p className="mb-1 font-semibold">Be specific</p>
                  <p>
                    A clear topic produces a tighter prompt, outline, and
                    vocabulary list — e.g. “Why Students Should Read Every Day”.
                  </p>
                </>
              }
            />
            <Textarea
              id="essay-topic"
              placeholder="e.g. Why Students Should Read Every Day"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              rows={2}
              maxLength={512}
            />
          </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Length &amp; style
              </h3>
              <p className="text-xs text-muted-foreground">
                Structure depth, target words, and writing voice.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-length"
              label="Essay Length"
              help={
                <>
                  <p className="mb-1 font-semibold">Structure depth</p>
                  <p>
                    Controls how many supporting sections the AI plans. Choose
                    Custom to set the target number of main points (1–10).
                  </p>
                </>
              }
            />
            <Select
              value={essayLength}
              items={ESSAY_LENGTH_OPTIONS}
              onValueChange={(v) => {
                if (v != null) setEssayLength(v as EssayLength);
              }}
            >
              <SelectTrigger id="essay-length" className="w-full">
                <SelectValue placeholder="Select length">
                  {(value) => optionLabel(ESSAY_LENGTH_OPTIONS, value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ESSAY_LENGTH_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {essayLength === "custom" ? (
              <div className="space-y-2 pt-1">
                <TeacherFieldLabel
                  htmlFor="essay-main-points"
                  label="Target Number of Main Points"
                  help={
                    <p>
                      Number of main supporting sections (1–10), not counting
                      introduction and conclusion.
                    </p>
                  }
                />
                <Input
                  id="essay-main-points"
                  type="number"
                  min={1}
                  max={10}
                  placeholder="e.g. 5"
                  value={customMainPoints}
                  onChange={(e) =>
                    setCustomMainPoints(
                      Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                    )
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-complexity"
              label="Essay Complexity"
              help={
                <>
                  <p className="mb-1 font-semibold">Reading &amp; reasoning level</p>
                  <p>
                    AI Recommended matches grade. Basic simplifies language;
                    University expects deeper analysis.
                  </p>
                </>
              }
            />
            <Select
              value={complexity}
              items={ESSAY_COMPLEXITY_OPTIONS}
              onValueChange={(v) => {
                if (v != null) setComplexity(v as EssayComplexity);
              }}
            >
              <SelectTrigger id="essay-complexity" className="w-full">
                <SelectValue placeholder="Select complexity">
                  {(value) => optionLabel(ESSAY_COMPLEXITY_OPTIONS, value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ESSAY_COMPLEXITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-words"
              label="Word Count"
              help={
                <>
                  <p className="mb-1 font-semibold">Target length</p>
                  <p>
                    AI Recommended scales by grade. Pick a preset or Custom for
                    an exact target (about 50–5000 words).
                  </p>
                </>
              }
            />
            <Select
              value={wordCountPreset}
              items={ESSAY_WORD_COUNT_OPTIONS}
              onValueChange={(v) => {
                if (v != null) setWordCountPreset(v as EssayWordCountPreset);
              }}
            >
              <SelectTrigger id="essay-words" className="w-full">
                <SelectValue placeholder="Select word count">
                  {(value) => optionLabel(ESSAY_WORD_COUNT_OPTIONS, value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ESSAY_WORD_COUNT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {wordCountPreset === "custom" ? (
              <div className="space-y-1.5 pt-1">
                <Label
                  htmlFor="essay-words-custom"
                  className="text-xs text-muted-foreground"
                >
                  Exact target (50–5000)
                </Label>
                <Input
                  id="essay-words-custom"
                  type="number"
                  min={50}
                  max={5000}
                  placeholder="e.g. 650"
                  value={customWordCount}
                  onChange={(e) =>
                    setCustomWordCount(Number(e.target.value) || 500)
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-style"
              label="Writing Style"
              help={
                <p>
                  Guides voice and register in the prompt, outline, and model
                  essay (academic, formal, conversational, and more).
                </p>
              }
            />
            <Select
              value={writingStyle}
              items={ESSAY_WRITING_STYLE_OPTIONS}
              onValueChange={(v) => {
                if (v != null) setWritingStyle(v as EssayWritingStyle);
              }}
            >
              <SelectTrigger id="essay-style" className="w-full">
                <SelectValue placeholder="Select writing style">
                  {(value) => optionLabel(ESSAY_WRITING_STYLE_OPTIONS, value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ESSAY_WRITING_STYLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-tone"
              label="Tone"
              help={
                <p>
                  Sets the overall tone students should aim for (neutral,
                  persuasive, reflective, etc.).
                </p>
              }
            />
            <Select
              value={tone}
              items={ESSAY_TONE_OPTIONS}
              onValueChange={(v) => {
                if (v != null) setTone(v as EssayTone);
              }}
            >
              <SelectTrigger id="essay-tone" className="w-full">
                <SelectValue placeholder="Select tone">
                  {(value) => optionLabel(ESSAY_TONE_OPTIONS, value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ESSAY_TONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!showStance ? (
          <div className="flex items-center justify-between gap-3 space-y-0 rounded-md border border-border p-3 sm:col-span-2">
            <div className="space-y-0.5">
              <TeacherFieldLabel
                htmlFor="essay-counterargument"
                label="Include Counterargument"
                help={
                  <p>
                    When on, the AI plans a dedicated counterargument or
                    opposing-view section where the essay type supports it.
                  </p>
                }
              />
            </div>
            <Switch
              id="essay-counterargument"
              checked={includeCounterargument}
              onCheckedChange={setIncludeCounterargument}
            />
          </div>
          ) : null}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Citations &amp; extras
              </h3>
              <p className="text-xs text-muted-foreground">
                Optional research, standards, accommodations, and included
                supports.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-citations"
              label="Citations"
              help={
                <p>
                  Choose a citation style for research-style tasks, or None when
                  sources are not required.
                </p>
              }
            />
            <Select
              value={citationStyle}
              items={ESSAY_CITATION_OPTIONS}
              onValueChange={(v) => {
                if (v == null) return;
                const next = v as EssayCitationStyle;
                setCitationStyle(next);
                if (next !== "none" && sourcesRequired === 0) {
                  setSourcesRequired(3);
                }
                if (next === "none") {
                  setSourcesRequired(0);
                }
              }}
            >
              <SelectTrigger id="essay-citations" className="w-full">
                <SelectValue placeholder="Select citation style">
                  {(value) => optionLabel(ESSAY_CITATION_OPTIONS, value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ESSAY_CITATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} label={opt.label}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-sources"
              label="Sources Required"
              help={
                <p>
                  How many sources students should cite (0–20). Use 0 when no
                  research is expected.
                </p>
              }
            />
            <Input
              id="essay-sources"
              type="number"
              min={0}
              max={20}
              placeholder="e.g. 2"
              value={sourcesRequired}
              onChange={(e) =>
                setSourcesRequired(
                  Math.min(20, Math.max(0, Number(e.target.value) || 0)),
                )
              }
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="essay-standard"
              label="Learning Standard (optional)"
              help={
                <>
                  <p className="mb-1 font-semibold">Examples:</p>
                  <ul className="list-disc space-y-0.5 pl-4">
                    <li>Common Core State Standards (CCSS)</li>
                    <li>Next Generation Science Standards (NGSS)</li>
                    <li>Jamaica National Standards Curriculum (NSC)</li>
                    <li>CARICOM regional curriculum</li>
                  </ul>
                  <p className="mt-2">
                    When the standard is linked to Jamaica, generation uses
                    Jamaica NSC structure guidelines.
                  </p>
                </>
              }
            />
            <Input
              id="essay-standard"
              placeholder="e.g. NGSS, Common Core (CCSS), Jamaica NSC"
              value={learningStandard}
              onChange={(e) => setLearningStandard(e.target.value)}
              maxLength={512}
            />
          </div>

          <div className="space-y-3 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="essay-accommodations"
              label="Accommodations"
              help={
                <p>
                  Optional scaffolds (dyslexia-friendly layout, sentence
                  starters, ELL supports, extended time, and more).
                </p>
              }
            />
            <div id="essay-accommodations" className="grid gap-2 sm:grid-cols-2">
              {ESSAY_ACCOMMODATION_OPTIONS.map((opt) => {
                const id = `essay-acc-${opt.value}`;
                const checked = accommodations.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    htmlFor={id}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(v) =>
                        toggleAccommodation(opt.value, v === true)
                      }
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="essay-time"
              label="Time Limit (minutes, 0 = none)"
              help={
                <>
                  <p className="mb-1 font-semibold">Optional timer</p>
                  <p>
                    Set minutes for a timed writing activity, or leave 0 for no
                    time limit.
                  </p>
                </>
              }
            />
            <Input
              id="essay-time"
              type="number"
              min={0}
              max={240}
              placeholder="e.g. 45"
              value={timeLimitMinutes}
              onChange={(e) =>
                setTimeLimitMinutes(Number(e.target.value) || 0)
              }
            />
          </div>

          <div className="flex flex-col gap-3 sm:col-span-2">
            <Label className="text-sm text-muted-foreground">
              Include in generation
            </Label>
            {(
              [
                [
                  "includeVocabulary",
                  includeVocabulary,
                  setIncludeVocabulary,
                  "Include Vocabulary",
                ],
                [
                  "includeOutline",
                  includeOutline,
                  setIncludeOutline,
                  "Include Outline",
                ],
                [
                  "includeRubric",
                  includeRubric,
                  setIncludeRubric,
                  "Include Rubric",
                ],
                [
                  "includeModelEssay",
                  includeModelEssay,
                  setIncludeModelEssay,
                  "Include Model Essay (hidden until revealed)",
                ],
              ] as const
            ).map(([id, checked, setChecked, label]) => (
              <label
                key={id}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => setChecked(v === true)}
                  id={id}
                />
                {label}
              </label>
            ))}
          </div>

            </div>
          </section>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
            <Button type="submit" disabled={pending} className="min-w-44">
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating…
                </>
              ) : (
                "Generate essay activity"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Creates a prompt, outline, vocabulary, and rubric for this setup.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
