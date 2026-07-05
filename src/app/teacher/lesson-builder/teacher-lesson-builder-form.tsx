"use client";

import { useCallback, useRef, useState } from "react";
import { Download, Loader2, Pencil, RefreshCw, Save, X } from "lucide-react";
import { generateLessonPlanAction, saveLessonPlanAction } from "@/actions/teacher-lesson-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  cloneLessonPlanResult,
  LessonPlanPreviewEditor,
} from "@/components/lesson-plan-preview-editor";
import {
  LessonPlanReferenceMaterialFields,
  type LessonPlanReferenceMaterial,
  type LessonPlanReferenceMaterialFieldsHandle,
} from "@/components/lesson-plan-reference-material-fields";
import { TeacherToolPageShell } from "@/components/teacher-tool-page-shell";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { TeacherTopicFieldHelpContent } from "@/components/teacher-field-help-content";
import { LESSON_DIFFICULTY_LEVELS } from "@/lib/lesson-plan-difficulty";
import type {
  LessonPlanActionInput,
  VocabularyTeachingApproach,
} from "@/lib/lesson-plan-ai-schema";
import { VOCABULARY_TEACHING_APPROACH_OPTIONS } from "@/lib/lesson-plan-vocabulary-approach";
import { downloadLessonPlanPdf } from "@/lib/lesson-plan-pdf";
import type { LessonPlanInput, LessonPlanResult } from "@/lib/teacher-generators";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  buildTeacherQuizzesPath,
  buildTeacherSubPath,
  type TeacherWorkspaceContext,
} from "@/lib/teacher-url";

const DIFFICULTY_LEVEL_OPTIONS = LESSON_DIFFICULTY_LEVELS;

type TeacherLessonBuilderFormProps = {
  hasAdvancedSourceImport: boolean;
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
};

export function TeacherLessonBuilderForm({
  hasAdvancedSourceImport,
  backHref = "/teacher",
  teacherWorkspace,
}: TeacherLessonBuilderFormProps) {
  const referenceFieldsRef = useRef<LessonPlanReferenceMaterialFieldsHandle>(null);
  const [referenceMaterials, setReferenceMaterials] = useState<
    LessonPlanReferenceMaterial[]
  >([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [form, setForm] = useState<LessonPlanInput>({
    subject: "",
    gradeLevel: "",
    topic: "",
    lessonDuration: "45 minutes",
    difficultyLevel: "Intermediate",
    learningStandard: "",
    classSize: "",
    specialInstructions: "",
  });
  const [result, setResult] = useState<LessonPlanResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedPlanId, setSavedPlanId] = useState<number | null>(null);
  const [regenerationSeed, setRegenerationSeed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<LessonPlanResult | null>(null);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateApproach, setRegenerateApproach] =
    useState<VocabularyTeachingApproach>("weekly");

  const runGeneration = useCallback(
    async (
      isRegenerate: boolean,
      vocabularyTeachingApproach?: VocabularyTeachingApproach,
    ) => {
      setIsGenerating(true);
      setErrorMessage(null);
      setIsEditing(false);
      setEditDraft(null);

      const seed = isRegenerate ? regenerationSeed + 1 : 0;
      if (isRegenerate) {
        setRegenerationSeed(seed);
      } else {
        setRegenerationSeed(0);
      }

      try {
        const resolvedReferences =
          (await referenceFieldsRef.current?.resolveReferences()) ?? referenceMaterials;

        const plan = await generateLessonPlanAction({
          ...form,
          difficultyLevel:
            form.difficultyLevel as LessonPlanActionInput["difficultyLevel"],
          regenerationSeed: seed,
          vocabularyTeachingApproach: isRegenerate
            ? vocabularyTeachingApproach
            : undefined,
          referenceMaterials:
            resolvedReferences.length > 0 ? resolvedReferences : undefined,
        });
        setResult(plan);
        setShowResult(true);
        setSavedPlanId(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Lesson generation failed. Please try again.";
        setErrorMessage(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [form, regenerationSeed, referenceMaterials],
  );

  function startEditing() {
    if (!result) return;
    setEditDraft(cloneLessonPlanResult(result));
    setIsEditing(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditDraft(null);
  }

  function finishEditing() {
    if (!editDraft) return;
    setResult(editDraft);
    setSavedPlanId(null);
    setIsEditing(false);
    setEditDraft(null);
    toast.success("Lesson plan updated", {
      description: "Your edits are ready to save or download.",
    });
  }

  function handleRegenerateConfirm() {
    setRegenerateDialogOpen(false);
    void runGeneration(true, regenerateApproach);
  }

  async function handleSavePlan() {
    if (!result) return;
    setIsSaving(true);
    try {
      const saved = await saveLessonPlanAction({ input: form, result });
      setSavedPlanId(saved.id);
      const quizzesHref = teacherWorkspace
        ? buildTeacherQuizzesPath(
            teacherWorkspace.teamId,
            teacherWorkspace.teamMemberId,
            new URLSearchParams({ lessonPlanId: String(saved.id) }),
          )
        : `/teacher/quizzes?lessonPlanId=${saved.id}`;
      const resourcesHref = teacherWorkspace
        ? buildTeacherSubPath(
            "/resources",
            teacherWorkspace.teamId,
            teacherWorkspace.teamMemberId,
          )
        : "/teacher/resources";
      toast.success("Lesson plan saved", {
        description: (
          <span>
            {saved.lessonTitle} was saved with input data
            {saved.pdfUrl ? " and PDF" : ""}. Use it in the{" "}
            <Link href={quizzesHref} className="underline underline-offset-2">
              Quiz Generator
            </Link>{" "}
            or{" "}
            <Link href={resourcesHref} className="underline underline-offset-2">
              Resource Library
            </Link>
            .
          </span>
        ),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save lesson plan.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadPdf() {
    if (!result) return;
    setIsDownloading(true);
    try {
      await downloadLessonPlanPdf(result);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <>
      <TeacherToolPageShell
        title="AI Lesson Builder"
        description="Generate a structured lesson plan for review before saving."
        backHref={backHref}
        showResult={showResult}
        isGenerating={isGenerating}
        errorMessage={errorMessage ?? referenceError}
        onGenerate={() => runGeneration(false)}
        result={
          result ? (
            <LessonPlanPreviewEditor
              result={result}
              isEditing={isEditing}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
            />
          ) : null
        }
        previewActions={
          result ? (
            <>
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelEditing}
                  >
                    <X className="size-4" aria-hidden />
                    Cancel
                  </Button>
                  <Button type="button" size="sm" onClick={finishEditing}>
                    Done editing
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isGenerating || isSaving}
                    onClick={startEditing}
                  >
                    <Pencil className="size-4" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isGenerating}
                    onClick={() => setRegenerateDialogOpen(true)}
                  >
                    {isGenerating ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="size-4" aria-hidden />
                    )}
                    Regenerate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSaving || savedPlanId !== null}
                    onClick={handleSavePlan}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-4" aria-hidden />
                    )}
                    {savedPlanId !== null ? "Saved" : "Save Lesson Plan"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isDownloading}
                    onClick={handleDownloadPdf}
                  >
                    {isDownloading ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Download className="size-4" aria-hidden />
                    )}
                    Download PDF
                  </Button>
                </>
              )}
            </>
          ) : null
        }
      >
      <TooltipProvider>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="subject"
              label="Subject"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>Science, Social Studies, Mathematics, English Language Arts</p>
                </>
              }
            />
            <Input
              id="subject"
              placeholder="e.g. Science"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="gradeLevel"
              label="Grade Level"
              help={
                <>
                  <p className="mb-1 font-semibold">Examples by level:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Primary: Grade 1, Grade 2, Grade 3, Grade 4, Grade 5, Grade 6</li>
                    <li>Secondary: Grade 7, Grade 8, Grade 9, Grade 10, Grade 11</li>
                    <li>Tertiary: Year 1, Year 2, 1st Year College, Undergraduate</li>
                  </ul>
                </>
              }
            />
            <Input
              id="gradeLevel"
              placeholder="e.g. Grade 5"
              value={form.gradeLevel}
              onChange={(e) => setForm((f) => ({ ...f, gradeLevel: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="topic"
              label="Topic"
              help={<TeacherTopicFieldHelpContent />}
            />
            <Input
              id="topic"
              placeholder="e.g. Water cycle"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="lessonDuration"
              label="Lesson Duration"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>45 minutes, 1 hour, 2 × 40-minute blocks</p>
                </>
              }
            />
            <Input
              id="lessonDuration"
              placeholder="e.g. 45 minutes"
              value={form.lessonDuration}
              onChange={(e) =>
                setForm((f) => ({ ...f, lessonDuration: e.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="difficultyLevel"
              label="Difficulty Level"
              help={
                <>
                  <p className="mb-1 font-semibold">Choose the class readiness level:</p>
                  <p>
                    Select All to show strategies for every tier in Differentiated
                    Instruction. Otherwise only the selected level appears in the
                    generated plan.
                  </p>
                  <p className="mt-1">
                    Beginner for foundational support; Intermediate for most classes;
                    Advanced for accelerated learners; Honors/Gifted for enrichment groups.
                  </p>
                </>
              }
            />
            <Select
              value={form.difficultyLevel}
              onValueChange={(value) => {
                if (value == null) return;
                setForm((f) => ({ ...f, difficultyLevel: value }));
              }}
            >
              <SelectTrigger
                id="difficultyLevel"
                className="h-10 w-full bg-background"
                aria-required
              >
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTY_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="learningStandard"
              label="Learning Standard (optional)"
              help={
                <>
                  <p className="mb-1 font-semibold">Examples:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Common Core State Standards (CCSS)</li>
                    <li>Next Generation Science Standards (NGSS)</li>
                    <li>C3 Framework for Social Studies</li>
                    <li>Jamaica National Standards Curriculum (NSC)</li>
                    <li>CARICOM regional curriculum</li>
                  </ul>
                </>
              }
            />
            <Input
              id="learningStandard"
              placeholder="e.g. NGSS, Common Core (CCSS), Jamaica NSC"
              value={form.learningStandard}
              onChange={(e) =>
                setForm((f) => ({ ...f, learningStandard: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <TeacherFieldLabel
              htmlFor="classSize"
              label="Class Size (optional)"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>23 students, 28, small group of 12</p>
                </>
              }
            />
            <Input
              id="classSize"
              placeholder="e.g. 23"
              value={form.classSize}
              onChange={(e) => setForm((f) => ({ ...f, classSize: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="specialInstructions"
              label="Special need or Accommodations (optional)"
              help={
                <>
                  <p className="mb-2">
                    This tells the AI how to adapt the lesson for students who need
                    additional support.
                  </p>
                  <p className="mb-1 font-semibold">Examples:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Reading</li>
                    <li>Dyslexia</li>
                    <li>Reading comprehension support</li>
                    <li>Large print materials</li>
                  </ul>
                </>
              }
            />
            <Textarea
              id="specialInstructions"
              placeholder="e.g. Dyslexia — use large print materials and reading comprehension support"
              value={form.specialInstructions}
              onChange={(e) =>
                setForm((f) => ({ ...f, specialInstructions: e.target.value }))
              }
              rows={3}
            />
          </div>

          <LessonPlanReferenceMaterialFields
            ref={referenceFieldsRef}
            hasAdvancedSourceImport={hasAdvancedSourceImport}
            disabled={isGenerating}
            value={referenceMaterials}
            onChange={setReferenceMaterials}
            onError={setReferenceError}
          />
        </div>
      </TooltipProvider>
      </TeacherToolPageShell>

      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Vocabulary teaching approach</DialogTitle>
            <DialogDescription>
              Choose how vocabulary should be distributed when regenerating this
              lesson plan. The AI will rebuild the plan using your Learning Standard
              and this pacing preference.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {VOCABULARY_TEACHING_APPROACH_OPTIONS.map((option) => {
              const selected = regenerateApproach === option.value;
              return (
                <Button
                  key={option.value}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className={cn(
                    "h-auto flex-col items-start gap-1 whitespace-normal px-4 py-3 text-left",
                    !selected && "text-foreground",
                  )}
                  onClick={() => setRegenerateApproach(option.value)}
                >
                  <span className="font-medium">{option.label}</span>
                  <span
                    className={cn(
                      "text-xs font-normal leading-snug",
                      selected ? "text-primary-foreground/90" : "text-muted-foreground",
                    )}
                  >
                    {option.description}
                  </span>
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRegenerateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleRegenerateConfirm}>
              Regenerate plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
