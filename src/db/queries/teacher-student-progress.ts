import "server-only";

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { decks } from "@/db/schema";
import { getQuizResultsForTeam } from "@/db/queries/quiz-results";
import { listTeacherClassesForUser } from "@/db/queries/teacher-classes";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import type { QuizResultSummary } from "@/components/quiz-result-detail-view";
import { resolveDeckSubjectAndTopic } from "@/lib/deck-subject-topic";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

export type TeacherStudentProgressSchedule = {
  period: string;
  gradeLevel: string | null;
  academicYear: string;
  termSemester: string;
  week: string;
  day: string;
};

export type TeacherStudentProgressRow = {
  resultId: number;
  deckId: number | null;
  memberUserId: string;
  memberName: string | null;
  memberEmail: string | null;
  memberRole: QuizResultSummary["memberRole"];
  subject: string;
  topic: string;
  gradeLevel: string | null;
  savedAt: Date;
  percent: number;
  summary: QuizResultSummary;
  schedule: TeacherStudentProgressSchedule | null;
};

export type TeacherStudentProgressMemberMeta = {
  role: "team_admin" | "team_member";
  addedByUserId: string | null;
  addedByAsOwner: boolean | null;
  name: string | null;
  email: string | null;
};

export type TeacherStudentProgressPayload = {
  rows: TeacherStudentProgressRow[];
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  memberMetaByUserId: Record<string, TeacherStudentProgressMemberMeta>;
};

function resolveMemberRole(
  userId: string,
  ownerUserId: string,
  memberRoleMap: Map<string, string>,
): QuizResultSummary["memberRole"] {
  if (userId === ownerUserId) return "owner";
  const role = memberRoleMap.get(userId);
  if (role === "team_admin") return "team_admin";
  if (role === "team_member") return "team_member";
  return null;
}

export async function listTeacherStudentProgressForWorkspace(
  teacherUserId: string,
  teamId: number | null,
): Promise<TeacherStudentProgressPayload> {
  if (teamId == null) {
    return {
      rows: [],
      ownerUserId: "",
      ownerName: null,
      ownerEmail: null,
      memberMetaByUserId: {},
    };
  }

  const [team, results, classes, members] = await Promise.all([
    getTeamById(teamId),
    getQuizResultsForTeam(teamId),
    listTeacherClassesForUser(teacherUserId, teamId),
    listTeamMembers(teamId),
  ]);

  if (!team || results.length === 0) {
    return {
      rows: [],
      ownerUserId: team?.ownerUserId ?? "",
      ownerName: null,
      ownerEmail: null,
      memberMetaByUserId: {},
    };
  }

  const classByDeckId = new Map<number, (typeof classes)[number]>();
  for (const cls of classes) {
    const existing = classByDeckId.get(cls.deckId);
    if (!existing || cls.updatedAt > existing.updatedAt) {
      classByDeckId.set(cls.deckId, cls);
    }
  }

  const memberRoleMap = new Map(members.map((m) => [m.userId, m.role]));
  const memberUserIds = members.map((member) => member.userId);
  const userIds = [
    ...new Set([
      ...results.map((result) => result.userId),
      team.ownerUserId,
      ...memberUserIds,
      ...members.map((member) => member.addedByUserId).filter((id): id is string => Boolean(id)),
    ]),
  ];
  const userDisplayById = await getClerkUserFieldDisplaysByIds(userIds);
  const ownerDisplay = userDisplayById[team.ownerUserId];

  const memberMetaByUserId: Record<string, TeacherStudentProgressMemberMeta> = {};
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

  const deckIds = [
    ...new Set(
      results
        .map((result) => result.deckId)
        .filter((deckId): deckId is number => deckId != null),
    ),
  ];
  const deckRows =
    deckIds.length > 0
      ? await db
          .select({
            id: decks.id,
            name: decks.name,
            description: decks.description,
            gradeLevel: decks.gradeLevel,
          })
          .from(decks)
          .where(inArray(decks.id, deckIds))
      : [];
  const deckById = new Map(deckRows.map((deck) => [deck.id, deck]));

  const rows = results.map((result) => {
    const takerDisplay = userDisplayById[result.userId];
    const matchedClass =
      result.deckId != null ? classByDeckId.get(result.deckId) ?? null : null;
    const deck = result.deckId != null ? deckById.get(result.deckId) ?? null : null;

    const deckName = deck?.name ?? matchedClass?.deckName ?? result.deckName;
    const deckDescription =
      deck?.description ?? matchedClass?.deckDescription ?? null;
    const { subject, topic } = resolveDeckSubjectAndTopic({
      name: deckName,
      description: deckDescription,
    });

    const memberRole = resolveMemberRole(
      result.userId,
      team.ownerUserId,
      memberRoleMap,
    );

    const summary: QuizResultSummary = {
      id: result.id,
      deckName: result.deckName,
      correct: result.correct,
      incorrect: result.incorrect,
      unanswered: result.unanswered,
      total: result.total,
      percent: result.percent,
      elapsedSeconds: result.elapsedSeconds,
      savedAt: result.savedAt,
      perCard: result.perCard ?? null,
      userName: takerDisplay?.primaryLine ?? null,
      userEmail: takerDisplay?.primaryEmail ?? null,
      teamName: team.name,
      memberRole,
      ownerName: ownerDisplay?.primaryLine ?? null,
      ownerEmail: ownerDisplay?.primaryEmail ?? null,
    };

    const gradeLevel =
      matchedClass?.deckGradeLevel ?? deck?.gradeLevel ?? null;

    return {
      resultId: result.id,
      deckId: result.deckId ?? null,
      memberUserId: result.userId,
      memberName: takerDisplay?.primaryLine ?? null,
      memberEmail: takerDisplay?.primaryEmail ?? null,
      memberRole,
      subject: subject || "—",
      topic: topic || "—",
      gradeLevel,
      savedAt: result.savedAt,
      percent: result.percent,
      summary,
      schedule: matchedClass
        ? {
            period: matchedClass.period,
            gradeLevel,
            academicYear: matchedClass.academicYear,
            termSemester: matchedClass.termSemester,
            week: matchedClass.week,
            day: matchedClass.day,
          }
        : null,
    };
  });

  return {
    rows,
    ownerUserId: team.ownerUserId,
    ownerName: ownerDisplay?.primaryLine ?? null,
    ownerEmail: ownerDisplay?.primaryEmail ?? null,
    memberMetaByUserId,
  };
}
