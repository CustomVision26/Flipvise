import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getSavedLessonPlansByUser } from "@/db/queries/saved-lesson-plans";
import { getSavedHomeworkAssignmentsByUser } from "@/db/queries/saved-homework";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import {
  buildTeacherQuizzesPath,
  buildTeacherSubPath,
} from "@/lib/teacher-url";

const PLACEHOLDER_RESOURCES = {
  quizzes: [
    { title: "Civil War Review Quiz", subject: "History", grade: "8th" },
    { title: "Grammar Check-up", subject: "English", grade: "6th" },
  ],
  worksheets: [
    { title: "Linear Equations Practice", subject: "Math", grade: "9th" },
  ],
  studyGuides: [
    { title: "Cell Structure Study Guide", subject: "Biology", grade: "10th" },
  ],
};

function formatSourceLabel(homework: Awaited<
  ReturnType<typeof getSavedHomeworkAssignmentsByUser>
>[number]): string | null {
  if (homework.sourceType === "lesson_plan" && homework.sourceLessonPlanTitle) {
    return `From lesson plan: ${homework.sourceLessonPlanTitle}`;
  }
  if (homework.sourceType === "deck" && homework.sourceDeckName) {
    return `From deck: ${homework.sourceDeckName}`;
  }
  if (homework.sourceType === "topic") {
    return "From custom topic";
  }
  return null;
}

function formatSavedDate(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type TeacherResourcesPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
  }>;
};

export default async function TeacherResourcesPage({
  searchParams,
}: TeacherResourcesPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext(
    "/teacher/resources",
    params,
  );

  const lessonPlans = await getSavedLessonPlansByUser(userId);
  const homeworkAssignments = await getSavedHomeworkAssignmentsByUser(userId);
  const homeworkHref = buildTeacherSubPath(
    "/homework",
    workspace.teamId,
    workspace.teamMemberId,
  );

  const lessonBuilderHref = buildTeacherSubPath(
    "/lesson-builder",
    workspace.teamId,
    workspace.teamMemberId,
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Teacher Resource Library</h1>
          <p className="text-sm text-muted-foreground">
            Saved lesson plans, quizzes, worksheets, and study guides.
          </p>
        </div>
      </div>

      <Card className="border-border/80 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Saved Lesson Plans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lessonPlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved lesson plans yet. Generate one in the{" "}
              <Link href={lessonBuilderHref} className="underline underline-offset-2">
                AI Lesson Builder
              </Link>{" "}
              and click Save Lesson Plan.
            </p>
          ) : (
            lessonPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">{plan.lessonTitle}</p>
                  <p className="text-sm text-muted-foreground">
                    {plan.subject} · {plan.gradeLevel} · {plan.difficultyLevel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Saved {formatSavedDate(plan.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {plan.pdfUrl ? (
                    <a
                      href={plan.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      PDF
                    </a>
                  ) : null}
                  <Link
                    href={buildTeacherQuizzesPath(
                      workspace.teamId,
                      workspace.teamMemberId,
                      new URLSearchParams({ lessonPlanId: String(plan.id) }),
                    )}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Create Quiz
                  </Link>
                  <Badge variant="secondary">Saved</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/60">
        <CardHeader>
          <CardTitle className="text-base">Saved Homework</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {homeworkAssignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved homework yet. Generate one in the{" "}
              <Link href={homeworkHref} className="underline underline-offset-2">
                Homework Generator
              </Link>{" "}
              and click Save Homework.
            </p>
          ) : (
            homeworkAssignments.map((homework) => {
              const sourceLabel = formatSourceLabel(homework);
              return (
                <div
                  key={homework.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{homework.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {homework.subject} · {homework.gradeLevel} · {homework.difficultyLevel}
                    </p>
                    {sourceLabel ? (
                      <p className="text-xs text-muted-foreground">{sourceLabel}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Saved {formatSavedDate(homework.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {homework.pdfUrl ? (
                      <a
                        href={homework.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        PDF
                      </a>
                    ) : null}
                    <Badge variant="secondary">Saved</Badge>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {(
        Object.entries(PLACEHOLDER_RESOURCES) as Array<
          [keyof typeof PLACEHOLDER_RESOURCES, typeof PLACEHOLDER_RESOURCES.quizzes]
        >
      ).map(([section, items]) => (
        <Card key={section} className="border-border/80 bg-card/60">
          <CardHeader>
            <CardTitle className="text-base capitalize">
              Saved {section.replace(/([A-Z])/g, " $1").trim()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <div
                key={item.title}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.subject} · {item.grade}
                  </p>
                </div>
                <Badge variant="secondary">Placeholder</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
