import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  savedHomeworkAssignments,
  savedLessonPlans,
  type DeckRow,
} from "@/db/schema";
import { parseDeckSubjectTopic } from "@/lib/deck-subject-topic";
import {
  buildTeacherClassDeckHref,
  buildTeacherClassToolHref,
} from "@/lib/teacher-class-links";
import type { TeacherWorkspaceContext } from "@/lib/teacher-url";

export type SavedClassResourceLink = {
  id: number;
  title: string;
  pdfUrl: string | null;
  href: string | null;
};

export type ClassDeckResources = {
  lessonPlans: SavedClassResourceLink[];
  homework: SavedClassResourceLink[];
  studyGuides: SavedClassResourceLink[];
  worksheets: SavedClassResourceLink[];
  toolHrefs: {
    lessonBuilder: string;
    homework: string;
    studyGuides: string;
    worksheets: string;
    cards: string;
  };
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function lessonPlanMatchesDeck(
  plan: { subject: string; topic: string; gradeLevel: string },
  deck: Pick<DeckRow, "name" | "description" | "gradeLevel" | "difficultyLevel">,
): boolean {
  const { subject, topic } = parseDeckSubjectTopic(deck);
  const gradeLevel = deck.gradeLevel?.trim() ?? "";
  if (!subject && !topic && !gradeLevel) {
    return false;
  }
  const subjectMatch = !subject || normalize(plan.subject) === normalize(subject);
  const topicMatch = !topic || normalize(plan.topic) === normalize(topic);
  const gradeMatch = !gradeLevel || normalize(plan.gradeLevel) === normalize(gradeLevel);
  return subjectMatch && topicMatch && gradeMatch;
}

function resourcesHref(
  workspace: TeacherWorkspaceContext,
  section: "lesson-plans" | "homework",
): string {
  return buildTeacherClassToolHref("/resources", workspace, null, {
    section,
  });
}

export async function getTeacherClassDeckResources(
  userId: string,
  deckIds: number[],
  decksById: Map<number, Pick<DeckRow, "id" | "name" | "description" | "gradeLevel" | "difficultyLevel">>,
  workspace: TeacherWorkspaceContext,
): Promise<Map<number, ClassDeckResources>> {
  const uniqueDeckIds = [...new Set(deckIds.filter((id) => id > 0))];
  const result = new Map<number, ClassDeckResources>();

  for (const deckId of uniqueDeckIds) {
    const deck = decksById.get(deckId);
    result.set(deckId, {
      lessonPlans: [],
      homework: [],
      studyGuides: [],
      worksheets: [],
      toolHrefs: {
        lessonBuilder: buildTeacherClassToolHref("/lesson-builder", workspace, deckId),
        homework: buildTeacherClassToolHref("/homework", workspace, deckId, {
          sourceType: "deck",
        }),
        studyGuides: buildTeacherClassToolHref("/study-guides", workspace, deckId),
        worksheets: buildTeacherClassToolHref("/worksheets", workspace, deckId),
        cards: buildTeacherClassDeckHref(deckId),
      },
    });
  }

  if (uniqueDeckIds.length === 0) {
    return result;
  }

  const [homeworkRows, lessonPlanRows] = await Promise.all([
    db
      .select()
      .from(savedHomeworkAssignments)
      .where(
        and(
          eq(savedHomeworkAssignments.userId, userId),
          inArray(savedHomeworkAssignments.deckId, uniqueDeckIds),
        ),
      )
      .orderBy(desc(savedHomeworkAssignments.createdAt)),
    db
      .select()
      .from(savedLessonPlans)
      .where(
        and(
          eq(savedLessonPlans.userId, userId),
          inArray(savedLessonPlans.deckId, uniqueDeckIds),
        ),
      )
      .orderBy(desc(savedLessonPlans.createdAt)),
  ]);

  const lessonPlanById = new Map(lessonPlanRows.map((row) => [row.id, row]));

  for (const deckId of uniqueDeckIds) {
    const bucket = result.get(deckId);
    const deck = decksById.get(deckId);
    if (!bucket || !deck) continue;

    const deckHomework = homeworkRows.filter((row) => row.deckId === deckId);
    const seenLessonPlanIds = new Set<number>();
    const seenHomeworkIds = new Set<number>();

    for (const homework of deckHomework) {
      if (seenHomeworkIds.has(homework.id)) continue;
      seenHomeworkIds.add(homework.id);

      bucket.homework.push({
        id: homework.id,
        title: homework.label,
        pdfUrl: homework.pdfUrl,
        href: homework.pdfUrl ? null : resourcesHref(workspace, "homework"),
      });

      const studyGuideParams: Record<string, string> = {
        homeworkId: String(homework.id),
      };
      if (homework.savedLessonPlanId != null) {
        studyGuideParams.lessonPlanId = String(homework.savedLessonPlanId);
      }

      bucket.studyGuides.push({
        id: homework.id,
        title: homework.label,
        pdfUrl: null,
        href: buildTeacherClassToolHref("/study-guides", workspace, deckId, studyGuideParams),
      });

      if (homework.savedLessonPlanId != null) {
        const plan = lessonPlanById.get(homework.savedLessonPlanId);
        if (plan && !seenLessonPlanIds.has(plan.id)) {
          seenLessonPlanIds.add(plan.id);
          bucket.lessonPlans.push({
            id: plan.id,
            title: plan.lessonTitle,
            pdfUrl: plan.pdfUrl,
            href: plan.pdfUrl ? null : resourcesHref(workspace, "lesson-plans"),
          });
        }
      }
    }

    for (const plan of lessonPlanRows) {
      if (seenLessonPlanIds.has(plan.id)) continue;
      if (plan.deckId != null && plan.deckId !== deckId) continue;
      if (plan.deckId == null && !lessonPlanMatchesDeck(plan, deck)) continue;
      seenLessonPlanIds.add(plan.id);
      bucket.lessonPlans.push({
        id: plan.id,
        title: plan.lessonTitle,
        pdfUrl: plan.pdfUrl,
        href: plan.pdfUrl ? null : resourcesHref(workspace, "lesson-plans"),
      });
    }
  }

  return result;
}
