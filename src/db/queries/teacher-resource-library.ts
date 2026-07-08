import "server-only";

import { getSavedHomeworkAssignmentsByUserIds } from "@/db/queries/saved-homework";
import { getSavedLessonPlansByUserIds } from "@/db/queries/saved-lesson-plans";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import type { WorkspaceMemberMeta } from "@/lib/teacher-workspace-member-grouping";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

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
  lessonPlanId: number | null;
  homeworkId: number | null;
  quizHref: string | null;
  sourceLabel: string | null;
  isPlaceholder: boolean;
};

export type TeacherResourceLibrarySection = {
  id: "lessonPlans" | "homework" | "quizzes" | "worksheets" | "studyGuides";
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
  quizzes: [
    { title: "Civil War Review Quiz", subject: "History", grade: "8th" },
    { title: "Grammar Check-up", subject: "English", grade: "6th" },
  ],
  worksheets: [{ title: "Linear Equations Practice", subject: "Math", grade: "9th" }],
  studyGuides: [
    { title: "Cell Structure Study Guide", subject: "Biology", grade: "10th" },
  ],
} as const;

function formatHomeworkSourceLabel(homework: {
  sourceType: string;
  sourceLessonPlanTitle: string | null;
  sourceDeckName: string | null;
}): string | null {
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
    lessonPlanId: null,
    homeworkId: null,
    quizHref: null,
    sourceLabel: null,
    isPlaceholder: true,
  }));
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

  const [lessonPlans, homeworkAssignments] = await Promise.all([
    getSavedLessonPlansByUserIds(workspaceUserIds),
    getSavedHomeworkAssignmentsByUserIds(workspaceUserIds),
  ]);

  const lessonPlanItems: TeacherResourceLibraryItem[] = lessonPlans.map((plan) => {
    const creatorDisplay = userDisplayById[plan.userId];
    return {
      key: `lesson-plan:${plan.id}`,
      title: plan.lessonTitle,
      subject: plan.subject,
      gradeLevel: plan.gradeLevel,
      difficultyLevel: plan.difficultyLevel,
      creatorUserId: plan.userId,
      creatorName: creatorDisplay?.primaryLine ?? null,
      creatorEmail: creatorDisplay?.primaryEmail ?? null,
      savedAt: plan.createdAt.toISOString(),
      pdfUrl: plan.pdfUrl,
      lessonPlanId: plan.id,
      homeworkId: null,
      quizHref: null,
      sourceLabel: null,
      isPlaceholder: false,
    };
  });

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
      lessonPlanId: homework.savedLessonPlanId,
      homeworkId: homework.id,
      quizHref: null,
      sourceLabel: formatHomeworkSourceLabel(homework),
      isPlaceholder: false,
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
      emptyMessage:
        "No saved lesson plans yet. Generate one in the AI Lesson Builder and click Save Lesson Plan.",
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
      id: "quizzes",
      title: "Saved Quizzes",
      emptyMessage: "No saved quizzes yet.",
      items: placeholderItems(
        "quizzes",
        placeholderCreatorId,
        placeholderCreatorName,
        placeholderCreatorEmail,
      ),
    },
    {
      id: "worksheets",
      title: "Saved Worksheets",
      emptyMessage: "No saved worksheets yet.",
      items: placeholderItems(
        "worksheets",
        placeholderCreatorId,
        placeholderCreatorName,
        placeholderCreatorEmail,
      ),
    },
    {
      id: "studyGuides",
      title: "Saved Study Guides",
      emptyMessage: "No saved study guides yet.",
      items: placeholderItems(
        "studyGuides",
        placeholderCreatorId,
        placeholderCreatorName,
        placeholderCreatorEmail,
      ),
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
