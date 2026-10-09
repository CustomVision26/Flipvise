import { redirect } from "next/navigation";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { loadOwnerTeamAdminLessonPlanPicker } from "@/db/queries/teacher-owner-pickers";
import { getSavedLessonPlansForQuizPicker } from "@/db/queries/saved-lesson-plans";
import {
  resolveSavedWorksheetForViewer,
  mapSavedWorksheetRowToEditItem,
} from "@/db/queries/saved-worksheets";
import { buildTeacherSubPath } from "@/lib/teacher-url";
import { TeacherWorksheetsForm } from "@/components/teacher-worksheets-form";

type TeacherWorksheetsPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    deckId?: string;
    worksheetId?: string;
  }>;
};

export default async function TeacherWorksheetsPage({
  searchParams,
}: TeacherWorksheetsPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext("/teacher/worksheets", params);
  const parsedDeckId = params.deckId ? Number.parseInt(params.deckId, 10) : Number.NaN;
  const initialDeckId = Number.isFinite(parsedDeckId) ? parsedDeckId : undefined;
  const parsedWorksheetId = params.worksheetId
    ? Number.parseInt(params.worksheetId, 10)
    : Number.NaN;
  const initialWorksheetId = Number.isFinite(parsedWorksheetId)
    ? parsedWorksheetId
    : undefined;

  const savedWorksheet =
    initialWorksheetId != null
      ? await resolveSavedWorksheetForViewer(
          userId,
          initialWorksheetId,
          workspace.teamId,
        )
      : null;

  if (initialWorksheetId != null && !savedWorksheet) {
    redirect(
      buildTeacherSubPath("/resources", workspace.teamId, workspace.teamMemberId),
    );
  }

  const [ownerLessonPlanPicker, savedLessonPlans] = await Promise.all([
    loadOwnerTeamAdminLessonPlanPicker(userId, workspace.teamId),
    getSavedLessonPlansForQuizPicker(userId, workspace.teamId),
  ]);

  return (
    <TeacherWorksheetsForm
      ownerLessonPlanPicker={ownerLessonPlanPicker}
      savedLessonPlans={savedLessonPlans}
      teacherWorkspace={workspace}
      backHref={backHref}
      initialDeckId={savedWorksheet?.deckId ?? initialDeckId}
      initialSavedWorksheet={
        savedWorksheet ? mapSavedWorksheetRowToEditItem(savedWorksheet) : undefined
      }
    />
  );
}
