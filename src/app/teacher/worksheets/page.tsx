import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { loadOwnerTeamAdminDeckPicker } from "@/db/queries/teacher-owner-pickers";
import { TeacherWorksheetsForm } from "@/components/teacher-worksheets-form";

type TeacherWorksheetsPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
    deckId?: string;
  }>;
};

export default async function TeacherWorksheetsPage({
  searchParams,
}: TeacherWorksheetsPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext("/teacher/worksheets", params);
  const parsedDeckId = params.deckId ? Number.parseInt(params.deckId, 10) : Number.NaN;
  const initialDeckId = Number.isFinite(parsedDeckId) ? parsedDeckId : undefined;

  const [deckContext, ownerDeckPicker] = await Promise.all([
    loadTeacherDeckContext(userId),
    loadOwnerTeamAdminDeckPicker(userId, workspace.teamId),
  ]);

  return (
    <TeacherWorksheetsForm
      decks={deckContext.decks}
      ownerDeckPicker={ownerDeckPicker}
      teacherWorkspace={workspace}
      backHref={backHref}
      initialDeckId={initialDeckId}
    />
  );
}
