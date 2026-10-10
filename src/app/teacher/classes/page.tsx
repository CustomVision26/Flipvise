import { loadTeacherDeckContext } from "@/lib/load-teacher-deck-quota";
import { loadTeacherPageContext } from "@/lib/resolve-teacher-workspace-url";
import { loadTeacherClassesPagePayload } from "@/db/queries/teacher-classes";
import { getTeacherClassDeckResources } from "@/db/queries/teacher-class-resources";
import {
  getLinkedLessonPlanPeriodDaysByDeckIds,
  getPlanPeriodDaysByDeckIdsForUser,
} from "@/db/queries/saved-lesson-plans";
import { loadOwnerTeamAdminDeckPicker } from "@/db/queries/teacher-owner-pickers";
import type { ClassDeckResources } from "@/db/queries/teacher-class-resources";
import { TeacherClassesView } from "@/components/teacher-classes-view";

type TeacherClassesPageProps = {
  searchParams: Promise<{
    team?: string;
    teamMemberId?: string;
  }>;
};

export default async function TeacherClassesPage({
  searchParams,
}: TeacherClassesPageProps) {
  const params = await searchParams;
  const { userId, workspace, backHref } = await loadTeacherPageContext(
    "/teacher/classes",
    params,
  );

  const [classesPayload, deckContext, ownerDeckPicker] = await Promise.all([
    loadTeacherClassesPagePayload(userId, workspace.teamId),
    loadTeacherDeckContext(userId, workspace.teamId),
    loadOwnerTeamAdminDeckPicker(userId, workspace.teamId),
  ]);

  const ownerPickerDecks = Object.values(ownerDeckPicker.itemsByAdminUserId).flat();
  const [ownPlanPeriods, linkedPlanPeriods] = await Promise.all([
    getPlanPeriodDaysByDeckIdsForUser(userId, deckContext.decks),
    ownerDeckPicker.isWorkspaceOwner
      ? getLinkedLessonPlanPeriodDaysByDeckIds(ownerPickerDecks.map((deck) => deck.id))
      : Promise.resolve({} as Record<number, number>),
  ]);
  const planPeriodDaysByDeckId = { ...ownPlanPeriods, ...linkedPlanPeriods };
  const lessonPlanDeckIds = [
    ...new Set(
      [...Object.keys(ownPlanPeriods), ...Object.keys(linkedPlanPeriods)].map((id) =>
        Number(id),
      ),
    ),
  ];

  const decksById = new Map(
    deckContext.decks.map((deck) => [
      deck.id,
      {
        id: deck.id,
        name: deck.name,
        description: deck.description,
        gradeLevel: deck.gradeLevel,
        difficultyLevel: deck.difficultyLevel,
      },
    ]),
  );

  const deckResourcesByClassId: Record<number, ClassDeckResources> = {};

  const classesByCreator = new Map<string, typeof classesPayload.classes>();
  for (const cls of classesPayload.classes) {
    const bucket = classesByCreator.get(cls.userId) ?? [];
    bucket.push(cls);
    classesByCreator.set(cls.userId, bucket);
  }

  for (const [creatorUserId, creatorClasses] of classesByCreator) {
    const resourcesMap = await getTeacherClassDeckResources(
      creatorUserId,
      creatorClasses.map((cls) => cls.deckId),
      decksById,
      workspace,
    );

    for (const cls of creatorClasses) {
      const resources = resourcesMap.get(cls.deckId);
      if (resources) {
        deckResourcesByClassId[cls.id] = resources;
      }
    }
  }

  return (
    <TeacherClassesView
      classes={classesPayload.classes}
      viewerUserId={userId}
      creatorDisplayByUserId={classesPayload.creatorDisplayByUserId}
      ownerUserId={classesPayload.ownerUserId}
      ownerName={classesPayload.ownerName}
      ownerEmail={classesPayload.ownerEmail}
      memberMetaByUserId={classesPayload.memberMetaByUserId}
      isWorkspaceOwner={classesPayload.isWorkspaceOwner}
      decks={deckContext.decks}
      ownerDeckPicker={ownerDeckPicker.isWorkspaceOwner ? ownerDeckPicker : null}
      lessonPlanDeckIds={lessonPlanDeckIds}
      planPeriodDaysByDeckId={planPeriodDaysByDeckId}
      deckResourcesByClassId={deckResourcesByClassId}
      workspace={workspace}
      backHref={backHref}
    />
  );
}
