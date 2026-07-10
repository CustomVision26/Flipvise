import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadTeacherResourceLibrary } from "@/db/queries/teacher-resource-library";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import {
  buildTeacherLessonBuilderPath,
  buildTeacherHomeworkPath,
  buildTeacherWorksheetsPath,
  buildTeacherStudyGuidesPath,
  buildTeacherQuizzesPath,
  buildTeacherSubPath,
} from "@/lib/teacher-url";
import { TeacherResourceLibraryView } from "@/components/teacher-resource-library-view";

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

  const library = await loadTeacherResourceLibrary(userId, workspace.teamId);

  const sections = library.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      quizHref:
        item.lessonPlanId != null
          ? buildTeacherQuizzesPath(
              workspace.teamId,
              workspace.teamMemberId,
              new URLSearchParams({ lessonPlanId: String(item.lessonPlanId) }),
            )
          : null,
      lessonPlanEditHref:
        item.lessonPlanId != null && !item.isPlaceholder
          ? buildTeacherLessonBuilderPath(
              workspace.teamId,
              workspace.teamMemberId,
              new URLSearchParams({ lessonPlanId: String(item.lessonPlanId) }),
            )
          : null,
      homeworkEditHref:
        item.homeworkId != null && !item.isPlaceholder
          ? buildTeacherHomeworkPath(
              workspace.teamId,
              workspace.teamMemberId,
              new URLSearchParams({ homeworkId: String(item.homeworkId) }),
            )
          : null,
      worksheetEditHref:
        item.worksheetId != null && !item.isPlaceholder
          ? buildTeacherWorksheetsPath(
              workspace.teamId,
              workspace.teamMemberId,
              new URLSearchParams({ worksheetId: String(item.worksheetId) }),
            )
          : null,
      studyGuideEditHref:
        item.studyGuideId != null && !item.isPlaceholder
          ? buildTeacherStudyGuidesPath(
              workspace.teamId,
              workspace.teamMemberId,
              new URLSearchParams({ studyGuideId: String(item.studyGuideId) }),
            )
          : null,
    })),
  }));

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

      <TeacherResourceLibraryView
        sections={sections}
        viewerUserId={userId}
        teamId={workspace.teamId}
        ownerUserId={library.ownerUserId}
        ownerName={library.ownerName}
        ownerEmail={library.ownerEmail}
        memberMetaByUserId={library.memberMetaByUserId}
        isWorkspaceOwner={library.isWorkspaceOwner}
        lessonBuilderHref={lessonBuilderHref}
        homeworkHref={homeworkHref}
      />
    </div>
  );
}
