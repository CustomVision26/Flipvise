"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  LessonPlanReferenceMaterialFields,
  type LessonPlanReferenceMaterial,
  type LessonPlanReferenceMaterialFieldsHandle,
} from "@/components/lesson-plan-reference-material-fields";
import { TeacherFieldLabel } from "@/components/teacher-field-label";
import { TeacherTopicFieldHelpContent } from "@/components/teacher-field-help-content";
import { TeacherToolPageShell } from "@/components/teacher-tool-page-shell";
import {
  OwnerTeamAdminResourcePicker,
  useOwnerScopedItems,
} from "@/components/owner-team-admin-resource-picker";
import type { SavedHomeworkPickerItem } from "@/db/queries/saved-homework";
import type { SavedLessonPlanPickerItem } from "@/db/queries/saved-lesson-plans";
import type {
  OwnerTeamAdminHomeworkPickerPayload,
  OwnerTeamAdminLessonPlanPickerPayload,
} from "@/db/queries/teacher-owner-pickers";
import { ADMIN_NONE } from "@/lib/owner-team-admin-picker";
import { lessonPlanInputToQuizDefaults } from "@/lib/lesson-plan-quiz-context";
import { generateStudyGuideAction } from "@/actions/teacher-study-guide";
import { buildTeacherSubPath, type TeacherWorkspaceContext } from "@/lib/teacher-url";
import type { StudyGuideResult } from "@/lib/teacher-generators";

const SAVED_PLAN_NONE = "__none__";
const HOMEWORK_NONE = "__none__";

type StudyGuideFormState = {
  subject: string;
  gradeLevel: string;
  topic: string;
  savedLessonPlanId?: number;
  savedHomeworkId?: number;
};

const EMPTY_FORM: StudyGuideFormState = {
  subject: "",
  gradeLevel: "",
  topic: "",
};

export function TeacherStudyGuidesForm({
  savedLessonPlans = [],
  savedHomework = [],
  ownerLessonPlanPicker,
  ownerHomeworkPicker,
  hasAdvancedSourceImport = false,
  initialLessonPlanId,
  initialHomeworkId,
  backHref = "/teacher",
  teacherWorkspace,
}: {
  savedLessonPlans?: SavedLessonPlanPickerItem[];
  savedHomework?: SavedHomeworkPickerItem[];
  ownerLessonPlanPicker: OwnerTeamAdminLessonPlanPickerPayload;
  ownerHomeworkPicker: OwnerTeamAdminHomeworkPickerPayload;
  hasAdvancedSourceImport?: boolean;
  initialLessonPlanId?: number;
  initialHomeworkId?: number;
  backHref?: string;
  teacherWorkspace?: TeacherWorkspaceContext;
}) {
  const referenceFieldsRef = useRef<LessonPlanReferenceMaterialFieldsHandle>(null);
  const [referenceMaterials, setReferenceMaterials] = useState<
    LessonPlanReferenceMaterial[]
  >([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [form, setForm] = useState<StudyGuideFormState>(EMPTY_FORM);
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>(SAVED_PLAN_NONE);
  const [selectedHomeworkKey, setSelectedHomeworkKey] = useState<string>(HOMEWORK_NONE);
  const [result, setResult] = useState<StudyGuideResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [regenerationSeed, setRegenerationSeed] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string>(ADMIN_NONE);
  const [homeworkSearchQuery, setHomeworkSearchQuery] = useState("");

  const isWorkspaceOwner = ownerLessonPlanPicker.isWorkspaceOwner;
  const activeLessonPlans = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedAdminUserId,
    ownerLessonPlanPicker.lessonPlansByAdminUserId,
    savedLessonPlans,
  );
  const activeHomework = useOwnerScopedItems(
    isWorkspaceOwner,
    selectedAdminUserId,
    ownerHomeworkPicker.itemsByAdminUserId,
    savedHomework,
  );

  const selectedPlan =
    form.savedLessonPlanId != null
      ? activeLessonPlans.find((plan) => plan.id === form.savedLessonPlanId) ?? null
      : null;

  const homeworkForPlan = useMemo(
    () =>
      form.savedLessonPlanId != null
        ? activeHomework.filter(
            (item) => item.savedLessonPlanId === form.savedLessonPlanId,
          )
        : [],
    [form.savedLessonPlanId, activeHomework],
  );

  const filteredHomeworkForPlan = useMemo(() => {
    const query = homeworkSearchQuery.trim().toLowerCase();
    if (!query) return homeworkForPlan;
    return homeworkForPlan.filter((item) =>
      [item.label, item.assignmentTitle, item.subject, item.topic]
        .filter((part) => part.trim())
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [homeworkForPlan, homeworkSearchQuery]);

  const selectedHomework =
    form.savedHomeworkId != null
      ? homeworkForPlan.find((item) => item.id === form.savedHomeworkId) ?? null
      : null;

  const lessonBuilderHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/lesson-builder",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/lesson-builder";

  const homeworkHref = teacherWorkspace
    ? buildTeacherSubPath(
        "/homework",
        teacherWorkspace.teamId,
        teacherWorkspace.teamMemberId,
      )
    : "/teacher/homework";

  function handleAdminChange(adminUserId: string) {
    setSelectedAdminUserId(adminUserId);
    setHomeworkSearchQuery("");
    setSelectedPlanKey(SAVED_PLAN_NONE);
    setSelectedHomeworkKey(HOMEWORK_NONE);
    setForm(EMPTY_FORM);
  }

  function lessonPlanHaystack(plan: SavedLessonPlanPickerItem): string {
    return [plan.lessonTitle, plan.subject, plan.gradeLevel, plan.topic]
      .filter((part) => part.trim())
      .join(" ")
      .toLowerCase();
  }

  function handleSavedPlanChange(value: string | null) {
    if (!value || value === SAVED_PLAN_NONE) {
      setSelectedPlanKey(SAVED_PLAN_NONE);
      setSelectedHomeworkKey(HOMEWORK_NONE);
      setHomeworkSearchQuery("");
      setForm(EMPTY_FORM);
      return;
    }

    const planId = Number(value);
    const plan = activeLessonPlans.find((item) => item.id === planId);
    if (!plan) return;

    const defaults = lessonPlanInputToQuizDefaults(plan.input);
    setSelectedPlanKey(value);
    setSelectedHomeworkKey(HOMEWORK_NONE);
    setHomeworkSearchQuery("");
    setForm({
      savedLessonPlanId: plan.id,
      subject: defaults.subject,
      gradeLevel: defaults.gradeLevel,
      topic: defaults.topic,
    });
  }

  function handleHomeworkChange(value: string | null) {
    if (!value || value === HOMEWORK_NONE) {
      setSelectedHomeworkKey(HOMEWORK_NONE);
      setForm((current) => ({
        ...current,
        savedHomeworkId: undefined,
      }));
      return;
    }

    const homeworkId = Number(value);
    const homework = homeworkForPlan.find((item) => item.id === homeworkId);
    if (!homework) return;

    setSelectedHomeworkKey(value);
    setForm((current) => ({
      ...current,
      savedHomeworkId: homework.id,
    }));
  }

  useEffect(() => {
    if (initialHomeworkId) {
      const homework = activeHomework.find((item) => item.id === initialHomeworkId);
      if (homework) {
        if (homework.savedLessonPlanId != null) {
          const plan = activeLessonPlans.find((item) => item.id === homework.savedLessonPlanId);
          if (plan) {
            const defaults = lessonPlanInputToQuizDefaults(plan.input);
            if (isWorkspaceOwner) {
              const adminWithPlan = ownerLessonPlanPicker.teamAdmins.find((admin) =>
                (ownerLessonPlanPicker.lessonPlansByAdminUserId[admin.userId] ?? []).some(
                  (item) => item.id === plan.id,
                ),
              );
              if (adminWithPlan) {
                setSelectedAdminUserId(adminWithPlan.userId);
              }
            }
            setSelectedPlanKey(String(plan.id));
            setSelectedHomeworkKey(String(homework.id));
            setForm({
              savedLessonPlanId: plan.id,
              savedHomeworkId: homework.id,
              subject: defaults.subject,
              gradeLevel: defaults.gradeLevel,
              topic: defaults.topic,
            });
            return;
          }
        }
      }
    }

    if (!initialLessonPlanId) return;
    const exists = activeLessonPlans.some((plan) => plan.id === initialLessonPlanId);
    if (exists) {
      if (isWorkspaceOwner) {
        const adminWithPlan = ownerLessonPlanPicker.teamAdmins.find((admin) =>
          (ownerLessonPlanPicker.lessonPlansByAdminUserId[admin.userId] ?? []).some(
            (item) => item.id === initialLessonPlanId,
          ),
        );
        if (adminWithPlan) {
          setSelectedAdminUserId(adminWithPlan.userId);
        }
      }
      handleSavedPlanChange(String(initialLessonPlanId));
    }
  }, [
    initialHomeworkId,
    initialLessonPlanId,
    activeHomework,
    activeLessonPlans,
    isWorkspaceOwner,
    ownerLessonPlanPicker,
  ]);

  async function runGeneration(isRegenerate = false) {
    setIsGenerating(true);
    setErrorMessage(null);
    setReferenceError(null);

    const seed = isRegenerate ? regenerationSeed + 1 : 0;
    if (isRegenerate) {
      setRegenerationSeed(seed);
    } else {
      setRegenerationSeed(0);
    }

    try {
      const resolvedReferences = isRegenerate
        ? referenceMaterials
        : ((await referenceFieldsRef.current?.resolveReferences()) ?? referenceMaterials);

      if (!isRegenerate && resolvedReferences.length > 0) {
        setReferenceMaterials(resolvedReferences);
      }

      const studyGuide = await generateStudyGuideAction({
        subject: form.subject,
        gradeLevel: form.gradeLevel,
        topic: form.topic,
        savedLessonPlanId: form.savedLessonPlanId,
        savedHomeworkId: form.savedHomeworkId,
        referenceMaterials:
          resolvedReferences.length > 0 ? resolvedReferences : undefined,
        teamId: teacherWorkspace?.teamId ?? undefined,
      });

      setResult(studyGuide);
      setShowResult(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Study guide generation failed. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleGenerate() {
    await runGeneration(false);
  }

  function handleRegenerate() {
    void runGeneration(true);
  }

  const selectedPlanLabel = selectedPlan
    ? `${selectedPlan.lessonTitle} (${selectedPlan.subject} · ${selectedPlan.gradeLevel})`
    : null;

  const selectedHomeworkLabel = selectedHomework?.label ?? null;

  return (
    <TeacherToolPageShell
      title="Study Guide Generator"
      description="Build study guides with summaries, vocabulary, and practice questions."
      backHref={backHref}
      showResult={showResult}
      onGenerate={handleGenerate}
      isGenerating={isGenerating}
      generateWithAiIcon
      generateLabel="Generate"
      submittingLabel="Generating…"
      errorMessage={errorMessage ?? referenceError}
      previewActions={
        result ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isGenerating}
            onClick={handleRegenerate}
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Regenerate AI
          </Button>
        ) : null
      }
      result={
        result ? (
          <div className="space-y-4 text-foreground">
            <p>{result.summary}</p>
            <div>
              <p className="font-medium text-foreground">Key Vocabulary</p>
              <ul className="list-disc pl-5">
                {(result.keyVocabulary ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Important Points</p>
              <ul className="list-disc pl-5">
                {(result.importantPoints ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Worked Examples</p>
              <ul className="list-disc pl-5">
                {(result.workedExamples ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Sample Problems</p>
              <ul className="list-disc pl-5">
                {(result.sampleProblems ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Practice Questions</p>
              <ul className="list-disc pl-5">
                {(result.practiceQuestions ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground">Study Tips</p>
              <ul className="list-disc pl-5">
                {(result.studyTips ?? []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null
      }
    >
      <TooltipProvider>
        <div className="grid gap-4 sm:grid-cols-2">
          {isWorkspaceOwner ? (
            <OwnerTeamAdminResourcePicker
              ownerPicker={ownerLessonPlanPicker}
              itemsByAdminUserId={ownerLessonPlanPicker.lessonPlansByAdminUserId}
              selectedAdminUserId={selectedAdminUserId}
              onAdminChange={handleAdminChange}
              selectedItemKey={selectedPlanKey}
              onItemChange={handleSavedPlanChange}
              noneValue={SAVED_PLAN_NONE}
              noneLabel="No saved lesson plan"
              placeholder="No saved lesson plan"
              resourceLabel="Saved lesson plan (optional)"
              resourceSelectId="studyGuideLessonPlan"
              adminSelectId="studyGuideTeamAdmin"
              getItemKey={(plan) => String(plan.id)}
              getItemLabel={(plan) => `${plan.lessonTitle} (${plan.subject} · ${plan.gradeLevel})`}
              getItemHaystack={lessonPlanHaystack}
              searchPlaceholder="Search lesson plans by title, subject, grade, or topic…"
              resourceHelp={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>
                    Select a plan saved from the AI Lesson Builder. Subject, grade,
                    and topic will auto-fill for your study guide.
                  </p>
                </>
              }
              resourceFooter={
                selectedPlan?.pdfUrl ? (
                  <p className="text-xs text-muted-foreground">
                    Lesson plan PDF:{" "}
                    <a
                      href={selectedPlan.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2"
                    >
                      View saved PDF
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </p>
                ) : null
              }
            />
          ) : (
          <div className="space-y-2 sm:col-span-2">
            <TeacherFieldLabel
              htmlFor="studyGuideLessonPlan"
              label="Saved lesson plan (optional)"
              help={
                <>
                  <p className="mb-1 font-semibold">Example:</p>
                  <p>
                    Select a plan saved from the AI Lesson Builder. Subject, grade,
                    and topic will auto-fill for your study guide.
                  </p>
                </>
              }
            />
            <Select value={selectedPlanKey} onValueChange={handleSavedPlanChange}>
              <SelectTrigger id="studyGuideLessonPlan" className="h-10 w-full bg-background">
                <SelectValue placeholder="Select a saved lesson plan">
                  {selectedPlanLabel ?? "No saved lesson plan"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SAVED_PLAN_NONE}>No saved lesson plan</SelectItem>
                {activeLessonPlans.map((plan) => (
                  <SelectItem key={plan.id} value={String(plan.id)}>
                    {plan.lessonTitle} ({plan.subject} · {plan.gradeLevel})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeLessonPlans.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No saved lesson plans yet. Save one in the{" "}
                <Link href={lessonBuilderHref} className="underline underline-offset-2">
                  AI Lesson Builder
                </Link>{" "}
                first.
              </p>
            ) : null}
            {selectedPlan?.pdfUrl ? (
              <p className="text-xs text-muted-foreground">
                Lesson plan PDF:{" "}
                <a
                  href={selectedPlan.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  View saved PDF
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </p>
            ) : null}
          </div>
          )}

          {form.savedLessonPlanId != null ? (
            <div className="space-y-2 sm:col-span-2">
              <TeacherFieldLabel
                htmlFor="studyGuideHomework"
                label="Homework assignment (optional)"
                help="If you generated homework from this lesson plan, select it to align the study guide with those questions."
              />
              {homeworkForPlan.length > 0 ? (
                <>
                  {isWorkspaceOwner ? (
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        value={homeworkSearchQuery}
                        onChange={(e) => setHomeworkSearchQuery(e.target.value)}
                        placeholder="Search homework by label, title, subject, or topic…"
                        className="pl-9"
                        aria-label="Search homework assignments"
                      />
                    </div>
                  ) : null}
                  <Select value={selectedHomeworkKey} onValueChange={handleHomeworkChange}>
                    <SelectTrigger id="studyGuideHomework" className="h-10 w-full bg-background">
                      <SelectValue placeholder="Select homework">
                        {selectedHomeworkLabel ?? "No homework selected"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={HOMEWORK_NONE}>No homework selected</SelectItem>
                      {(isWorkspaceOwner ? filteredHomeworkForPlan : homeworkForPlan).map(
                        (homework) => (
                          <SelectItem key={homework.id} value={String(homework.id)}>
                            {homework.label} ({homework.assignmentTitle})
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  {isWorkspaceOwner &&
                  homeworkForPlan.length > 0 &&
                  filteredHomeworkForPlan.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No homework matches your search.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No saved homework for this lesson plan. Generate homework in the{" "}
                  <Link href={homeworkHref} className="underline underline-offset-2">
                    Homework Generator
                  </Link>{" "}
                  using this lesson plan as the source.
                </p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gradeLevel">Grade Level</Label>
            <Input
              id="gradeLevel"
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
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              required
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
  );
}
