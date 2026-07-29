import "server-only";

import { getDeckContentUpdatedAtByIds } from "@/db/queries/decks";
import { getSavedHomeworkAssignmentsByUserIds } from "@/db/queries/saved-homework";
import {
  getAssignedDeckLessonPlansForMember,
  getSavedLessonPlansByUserIds,
  type SavedLessonPlanRow,
} from "@/db/queries/saved-lesson-plans";
import { getSavedStudyGuidesByUserIds } from "@/db/queries/saved-study-guides";
import { getSavedWorksheetsByUserIds } from "@/db/queries/saved-worksheets";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import type { WorkspaceMemberMeta } from "@/lib/teacher-workspace-member-grouping";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import {
  formatCompactDayScopeLabel,
  shortenTeacherTitleSegment,
} from "@/lib/teacher-generation-titles";
import type { LessonPlanDayScope } from "@/lib/lesson-plan-day-scope";
import type { SavedHomeworkGenerationInput } from "@/db/schema";
import type { SavedStudyGuideGenerationInput } from "@/db/schema";

function dayScopeLabelFromInput(
  dayScope: LessonPlanDayScope | null | undefined,
  multiDayHint?: boolean,
): string | null {
  if (dayScope == null) return null;
  // Only show All Days / Day N when a day scope was stored (multi-day generations).
  if (multiDayHint === false) return null;
  return formatCompactDayScopeLabel(dayScope);
}

function formatStudyGuideSourceLabel(guide: {
  sourceLessonPlanTitle: string | null;
  sourceHomeworkLabel: string | null;
  input?: SavedStudyGuideGenerationInput | null;
}): string | null {
  const parts: string[] = [];
  if (guide.sourceLessonPlanTitle) {
    parts.push(`From lesson plan: ${shortenTeacherTitleSegment(guide.sourceLessonPlanTitle, 48)}`);
  }
  if (guide.sourceHomeworkLabel) {
    parts.push(`Homework: ${shortenTeacherTitleSegment(guide.sourceHomeworkLabel, 40)}`);
  }
  const day = dayScopeLabelFromInput(guide.input?.dayScope);
  if (day) parts.push(day);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatHomeworkSourceLabel(homework: {
  sourceType: string;
  sourceLessonPlanTitle: string | null;
  sourceDeckName: string | null;
  input?: SavedHomeworkGenerationInput | null;
}): string | null {
  const parts: string[] = [];
  if (homework.sourceType === "lesson_plan" && homework.sourceLessonPlanTitle) {
    parts.push(
      `From lesson plan: ${shortenTeacherTitleSegment(homework.sourceLessonPlanTitle, 48)}`,
    );
    const day = dayScopeLabelFromInput(homework.input?.dayScope);
    if (day) parts.push(day);
  } else if (homework.sourceType === "deck" && homework.sourceDeckName) {
    parts.push(`From deck: ${shortenTeacherTitleSegment(homework.sourceDeckName, 48)}`);
    // Prefer day scope stored on homework input; else none (deck scope is in deck description / title).
    const day = dayScopeLabelFromInput(homework.input?.dayScope);
    if (day) parts.push(day);
  } else if (homework.sourceType === "topic") {
    parts.push("From custom topic");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatWorksheetSourceLabel(worksheet: {
  sourceDeckName: string;
  result?: { deckName?: string } | null;
}): string {
  const parts = [
    `From deck: ${shortenTeacherTitleSegment(worksheet.sourceDeckName, 48)}`,
  ];
  // Worksheet titles already embed deck + lesson scope; keep source line concise.
  return parts.join(" · ");
}

/** How a lesson plan appears for non-owner workspace viewers. */
export type TeacherLessonPlanLibraryOrigin = "assigned" | "mine";

export type TeacherResourceLibraryItem = {
  key: string;
  title: string;
  subject: string;
  gradeLevel: string;
  difficultyLevel: string | null;
  creatorUserId: string;
  creatorName: string | null;
  creatorEmail: string | null;
  savedAt: string;
  pdfUrl: string | null;
  answerKeyPdfUrl: string | null;
  lessonPlanId: number | null;
  lessonPlanEditHref: string | null;
  homeworkEditHref: string | null;
  worksheetEditHref: string | null;
  studyGuideEditHref: string | null;
  homeworkId: number | null;
  worksheetId: number | null;
  studyGuideId: number | null;
  savedQuizId: number | null;
  quizHref: string | null;
  sourceLabel: string | null;
  /** ISO timestamp when the linked source deck (or its cards) is newer than this resource. */
  sourceDeckUpdatedAt: string | null;
  /** True when a linked source deck changed after this resource was last saved/updated. */
  isOutdatedVsSourceDeck: boolean;
  /**
   * True when the lesson plan (or resource) still stores a `deckId` but that deck
   * row no longer exists — distinct from {@link isOutdatedVsSourceDeck}.
   */
  isSourceDeckDeleted: boolean;
  isPlaceholder: boolean;
  /**
   * Set on lesson-plan items for non-owner workspace viewers:
   * `assigned` = original linked to an assigned deck; `mine` = viewer-owned copy/plan.
   */
  lessonPlanOrigin: TeacherLessonPlanLibraryOrigin | null;
};

function toTimestampMs(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function resolveSourceDeckStaleState(
  planUpdatedAt: Date | string,
  planCreatedAt: Date | string,
  planDeckId: number | null | undefined,
  sourceDeckUpdatedAt: Date | undefined,
): {
  sourceDeckUpdatedAt: string | null;
  isOutdatedVsSourceDeck: boolean;
  isSourceDeckDeleted: boolean;
} {
  if (planDeckId != null && sourceDeckUpdatedAt == null) {
    return {
      sourceDeckUpdatedAt: null,
      isOutdatedVsSourceDeck: false,
      isSourceDeckDeleted: true,
    };
  }
  if (!sourceDeckUpdatedAt) {
    return {
      sourceDeckUpdatedAt: null,
      isOutdatedVsSourceDeck: false,
      isSourceDeckDeleted: false,
    };
  }
  const planFreshnessMs = Math.max(
    toTimestampMs(planUpdatedAt),
    toTimestampMs(planCreatedAt),
  );
  const deckMs = toTimestampMs(sourceDeckUpdatedAt);
  if (deckMs <= planFreshnessMs) {
    return {
      sourceDeckUpdatedAt: null,
      isOutdatedVsSourceDeck: false,
      isSourceDeckDeleted: false,
    };
  }
  return {
    sourceDeckUpdatedAt: sourceDeckUpdatedAt.toISOString(),
    isOutdatedVsSourceDeck: true,
    isSourceDeckDeleted: false,
  };
}

export type TeacherResourceLibrarySection = {
  id: "lessonPlans" | "homework" | "worksheets" | "studyGuides";
  title: string;
  emptyMessage: string;
  items: TeacherResourceLibraryItem[];
};

export type TeacherResourceLibraryPayload = {
  sections: TeacherResourceLibrarySection[];
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>;
  isWorkspaceOwner: boolean;
};

const PLACEHOLDER_RESOURCES = {
  worksheets: [{ title: "Linear Equations Practice", subject: "Math", grade: "9th" }],
  studyGuides: [
    { title: "Cell Structure Study Guide", subject: "Biology", grade: "10th" },
  ],
} as const;

function placeholderItems(
  sectionId: keyof typeof PLACEHOLDER_RESOURCES,
  creatorUserId: string,
  creatorName: string | null,
  creatorEmail: string | null,
): TeacherResourceLibraryItem[] {
  return PLACEHOLDER_RESOURCES[sectionId].map((item, index) => ({
    key: `${sectionId}:placeholder:${index}`,
    title: item.title,
    subject: item.subject,
    gradeLevel: item.grade,
    difficultyLevel: null,
    creatorUserId,
    creatorName,
    creatorEmail,
    savedAt: new Date(0).toISOString(),
    pdfUrl: null,
    answerKeyPdfUrl: null,
    lessonPlanId: null,
    lessonPlanEditHref: null,
    homeworkEditHref: null,
    worksheetEditHref: null,
    studyGuideEditHref: null,
    homeworkId: null,
    worksheetId: null,
    studyGuideId: null,
    savedQuizId: null,
    quizHref: null,
    sourceLabel: null,
    sourceDeckUpdatedAt: null,
    isOutdatedVsSourceDeck: false,
    isSourceDeckDeleted: false,
    isPlaceholder: true,
    lessonPlanOrigin: null,
  }));
}

/**
 * Workspace role suffix for lesson-plan creator display.
 * Only Owner and Team Admin are labeled; members and personal (no-team) views get "".
 */
function lessonPlanCreatorRoleSuffix(
  creatorUserId: string,
  ownerUserId: string | null,
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>,
): string {
  if (ownerUserId == null) return "";
  if (creatorUserId === ownerUserId) return " (Owner)";
  if (memberMetaByUserId[creatorUserId]?.role === "team_admin") {
    return " (Team Admin)";
  }
  return "";
}

function formatLessonPlanCreatorName(
  primaryLine: string | null | undefined,
  creatorUserId: string,
  ownerUserId: string | null,
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>,
): string | null {
  if (!primaryLine) return null;
  return `${primaryLine}${lessonPlanCreatorRoleSuffix(creatorUserId, ownerUserId, memberMetaByUserId)}`;
}

function mapLessonPlanToLibraryItem(
  plan: SavedLessonPlanRow,
  creatorDisplay: { primaryLine: string | null; primaryEmail: string | null } | undefined,
  stale: {
    sourceDeckUpdatedAt: string | null;
    isOutdatedVsSourceDeck: boolean;
    isSourceDeckDeleted: boolean;
  },
  origin: TeacherLessonPlanLibraryOrigin | null,
  ownerUserId: string | null,
  memberMetaByUserId: Record<string, WorkspaceMemberMeta>,
): TeacherResourceLibraryItem {
  const creatorName = formatLessonPlanCreatorName(
    creatorDisplay?.primaryLine,
    plan.userId,
    ownerUserId,
    memberMetaByUserId,
  );
  const sourceFromDeck = plan.sourceDeckName
    ? `From deck: ${plan.sourceDeckName}`
    : null;

  let sourceLabel = sourceFromDeck;
  if (origin === "assigned") {
    const creatorBit = creatorName ? ` · Created by ${creatorName}` : "";
    sourceLabel = plan.sourceDeckName
      ? `Assigned with deck: ${plan.sourceDeckName}${creatorBit}`
      : `Assigned with deck${creatorBit}`;
  }

  return {
    key: `lesson-plan:${plan.id}`,
    title: plan.lessonTitle,
    subject: plan.subject,
    gradeLevel: plan.gradeLevel,
    difficultyLevel: plan.difficultyLevel,
    creatorUserId: plan.userId,
    creatorName,
    creatorEmail: creatorDisplay?.primaryEmail ?? null,
    savedAt: plan.createdAt.toISOString(),
    pdfUrl: plan.pdfUrl,
    answerKeyPdfUrl: null,
    lessonPlanId: plan.id,
    lessonPlanEditHref: null,
    homeworkEditHref: null,
    worksheetEditHref: null,
    studyGuideEditHref: null,
    homeworkId: null,
    worksheetId: null,
    studyGuideId: null,
    savedQuizId: null,
    quizHref: null,
    sourceLabel,
    sourceDeckUpdatedAt: stale.sourceDeckUpdatedAt,
    isOutdatedVsSourceDeck: stale.isOutdatedVsSourceDeck,
    isSourceDeckDeleted: stale.isSourceDeckDeleted,
    isPlaceholder: false,
    lessonPlanOrigin: origin,
  };
}

export async function loadTeacherResourceLibrary(
  viewerUserId: string,
  teamId: number | null,
): Promise<TeacherResourceLibraryPayload> {
  const team = teamId != null ? await getTeamById(teamId) : null;
  const isWorkspaceOwner = team != null && team.ownerUserId === viewerUserId;
  const ownerUserId = team?.ownerUserId ?? viewerUserId;

  const members = teamId != null ? await listTeamMembers(teamId) : [];
  const workspaceUserIds = isWorkspaceOwner
    ? [...new Set([ownerUserId, ...members.map((member) => member.userId)])]
    : [viewerUserId];

  const userIds = [
    ...new Set([
      ...workspaceUserIds,
      ...members.map((member) => member.addedByUserId).filter((id): id is string => Boolean(id)),
    ]),
  ];
  const userDisplayById = await getClerkUserFieldDisplaysByIds(userIds);
  const ownerDisplay = userDisplayById[ownerUserId];
  const viewerDisplay = userDisplayById[viewerUserId];

  const memberMetaByUserId: Record<string, WorkspaceMemberMeta> = {};
  for (const member of members) {
    const display = userDisplayById[member.userId];
    memberMetaByUserId[member.userId] = {
      role: member.role,
      addedByUserId: member.addedByUserId ?? null,
      addedByAsOwner: member.addedByAsOwner ?? null,
      name: display?.primaryLine ?? null,
      email: display?.primaryEmail ?? null,
    };
  }

  const assignedLessonPlansPromise =
    !isWorkspaceOwner && teamId != null
      ? getAssignedDeckLessonPlansForMember(teamId, viewerUserId)
      : Promise.resolve([] as SavedLessonPlanRow[]);

  const [
    lessonPlans,
    assignedLessonPlans,
    homeworkAssignments,
    studyGuides,
    worksheets,
  ] = await Promise.all([
    getSavedLessonPlansByUserIds(workspaceUserIds),
    assignedLessonPlansPromise,
    getSavedHomeworkAssignmentsByUserIds(workspaceUserIds),
    getSavedStudyGuidesByUserIds(workspaceUserIds),
    getSavedWorksheetsByUserIds(workspaceUserIds),
  ]);

  const assignedCreatorIds = assignedLessonPlans.map((plan) => plan.userId);
  const needsExtraDisplays = assignedCreatorIds.filter(
    (id) => userDisplayById[id] == null,
  );
  if (needsExtraDisplays.length > 0) {
    const extraDisplays = await getClerkUserFieldDisplaysByIds(needsExtraDisplays);
    Object.assign(userDisplayById, extraDisplays);
  }

  const ownLessonPlanIds = new Set(lessonPlans.map((plan) => plan.id));
  const assignedPlansForLibrary = assignedLessonPlans.filter(
    (plan) => !ownLessonPlanIds.has(plan.id),
  );

  const lessonPlanDeckIds = [
    ...lessonPlans.map((plan) => plan.deckId),
    ...assignedPlansForLibrary.map((plan) => plan.deckId),
  ].filter((deckId): deckId is number => deckId != null);
  const sourceDeckUpdatedAtById =
    await getDeckContentUpdatedAtByIds(lessonPlanDeckIds);

  const teamOwnerUserId = team != null ? team.ownerUserId : null;

  const lessonPlanItems: TeacherResourceLibraryItem[] = [
    ...assignedPlansForLibrary.map((plan) => {
      const creatorDisplay = userDisplayById[plan.userId];
      const stale = resolveSourceDeckStaleState(
        plan.updatedAt,
        plan.createdAt,
        plan.deckId,
        plan.deckId != null
          ? sourceDeckUpdatedAtById.get(plan.deckId)
          : undefined,
      );
      return mapLessonPlanToLibraryItem(
        plan,
        creatorDisplay,
        stale,
        isWorkspaceOwner ? null : "assigned",
        teamOwnerUserId,
        memberMetaByUserId,
      );
    }),
    ...lessonPlans.map((plan) => {
      const creatorDisplay = userDisplayById[plan.userId];
      const stale = resolveSourceDeckStaleState(
        plan.updatedAt,
        plan.createdAt,
        plan.deckId,
        plan.deckId != null
          ? sourceDeckUpdatedAtById.get(plan.deckId)
          : undefined,
      );
      return mapLessonPlanToLibraryItem(
        plan,
        creatorDisplay,
        stale,
        isWorkspaceOwner ? null : "mine",
        teamOwnerUserId,
        memberMetaByUserId,
      );
    }),
  ];

  const homeworkItems: TeacherResourceLibraryItem[] = homeworkAssignments.map((homework) => {
    const creatorDisplay = userDisplayById[homework.userId];
    return {
      key: `homework:${homework.id}`,
      title: homework.label,
      subject: homework.subject,
      gradeLevel: homework.gradeLevel,
      difficultyLevel: homework.difficultyLevel,
      creatorUserId: homework.userId,
      creatorName: creatorDisplay?.primaryLine ?? null,
      creatorEmail: creatorDisplay?.primaryEmail ?? null,
      savedAt: homework.createdAt.toISOString(),
      pdfUrl: homework.pdfUrl,
      answerKeyPdfUrl: null,
      lessonPlanId: homework.savedLessonPlanId,
      lessonPlanEditHref: null,
      homeworkEditHref: null,
      worksheetEditHref: null,
      studyGuideEditHref: null,
      homeworkId: homework.id,
      worksheetId: null,
      studyGuideId: null,
      savedQuizId: null,
      quizHref: null,
      sourceLabel: formatHomeworkSourceLabel({
        sourceType: homework.sourceType,
        sourceLessonPlanTitle: homework.sourceLessonPlanTitle,
        sourceDeckName: homework.sourceDeckName,
        input: homework.input,
      }),
      sourceDeckUpdatedAt: null,
      isOutdatedVsSourceDeck: false,
      isSourceDeckDeleted: false,
      isPlaceholder: false,
      lessonPlanOrigin: null,
    };
  });

  const studyGuideItems: TeacherResourceLibraryItem[] = studyGuides.map((guide) => {
    const creatorDisplay = userDisplayById[guide.userId];
    return {
      key: `study-guide:${guide.id}`,
      title: guide.label,
      subject: guide.subject,
      gradeLevel: guide.gradeLevel,
      difficultyLevel: null,
      creatorUserId: guide.userId,
      creatorName: creatorDisplay?.primaryLine ?? null,
      creatorEmail: creatorDisplay?.primaryEmail ?? null,
      savedAt: guide.createdAt.toISOString(),
      pdfUrl: guide.pdfUrl,
      answerKeyPdfUrl: null,
      lessonPlanId: guide.savedLessonPlanId,
      lessonPlanEditHref: null,
      homeworkEditHref: null,
      worksheetEditHref: null,
      studyGuideEditHref: null,
      homeworkId: guide.savedHomeworkId,
      worksheetId: null,
      studyGuideId: guide.id,
      savedQuizId: null,
      quizHref: null,
      sourceLabel: formatStudyGuideSourceLabel({
        sourceLessonPlanTitle: guide.sourceLessonPlanTitle,
        sourceHomeworkLabel: guide.sourceHomeworkLabel,
        input: guide.input,
      }),
      sourceDeckUpdatedAt: null,
      isOutdatedVsSourceDeck: false,
      isSourceDeckDeleted: false,
      isPlaceholder: false,
      lessonPlanOrigin: null,
    };
  });

  const worksheetItems: TeacherResourceLibraryItem[] = worksheets.map((worksheet) => {
    const creatorDisplay = userDisplayById[worksheet.userId];
    return {
      key: `worksheet:${worksheet.id}`,
      title: worksheet.label,
      subject: worksheet.subject,
      gradeLevel: worksheet.gradeLevel,
      difficultyLevel: worksheet.difficultyLevel,
      creatorUserId: worksheet.userId,
      creatorName: creatorDisplay?.primaryLine ?? null,
      creatorEmail: creatorDisplay?.primaryEmail ?? null,
      savedAt: worksheet.createdAt.toISOString(),
      pdfUrl: worksheet.worksheetPdfUrl,
      answerKeyPdfUrl: worksheet.answerKeyPdfUrl,
      lessonPlanId: null,
      lessonPlanEditHref: null,
      homeworkEditHref: null,
      worksheetEditHref: null,
      studyGuideEditHref: null,
      homeworkId: null,
      worksheetId: worksheet.id,
      studyGuideId: null,
      savedQuizId: null,
      quizHref: null,
      sourceLabel: formatWorksheetSourceLabel(worksheet),
      sourceDeckUpdatedAt: null,
      isOutdatedVsSourceDeck: false,
      isSourceDeckDeleted: false,
      isPlaceholder: false,
      lessonPlanOrigin: null,
    };
  });

  const ownerName = ownerDisplay?.primaryLine ?? null;
  const ownerEmail = ownerDisplay?.primaryEmail ?? null;
  const placeholderCreatorId = isWorkspaceOwner ? ownerUserId : viewerUserId;
  const placeholderCreatorName = isWorkspaceOwner
    ? ownerName
    : viewerDisplay?.primaryLine ?? null;
  const placeholderCreatorEmail = isWorkspaceOwner
    ? ownerEmail
    : viewerDisplay?.primaryEmail ?? null;

  const sections: TeacherResourceLibrarySection[] = [
    {
      id: "lessonPlans",
      title: "Saved Lesson Plans",
      emptyMessage: isWorkspaceOwner
        ? "No saved lesson plans yet. Generate one in the AI Lesson Builder and click Save Lesson Plan."
        : "No lesson plans yet. Plans linked to decks assigned to you appear here automatically, and plans you save appear under My lesson plans.",
      items: lessonPlanItems,
    },
    {
      id: "homework",
      title: "Saved Homework",
      emptyMessage:
        "No saved homework yet. Generate one in the Homework Generator and click Save Homework.",
      items: homeworkItems,
    },
    {
      id: "worksheets",
      title: "Saved Worksheets",
      emptyMessage:
        "No saved worksheets yet. Generate one in the Worksheet Generator and click Save.",
      items: worksheetItems,
    },
    {
      id: "studyGuides",
      title: "Saved Study Guides",
      emptyMessage:
        "No saved study guides yet. Generate one in the Study Guide Generator and click Save.",
      items: studyGuideItems,
    },
  ];

  return {
    sections,
    ownerUserId,
    ownerName,
    ownerEmail,
    memberMetaByUserId,
    isWorkspaceOwner,
  };
}
