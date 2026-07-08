import {
  buildTeacherPageCanonicalPath,
  buildTeacherSubPath,
  type TeacherWorkspaceContext,
} from "@/lib/teacher-url";
import type { TeacherClassWithDeck } from "@/db/queries/teacher-classes";
import { parseDeckSubjectTopic } from "@/lib/deck-subject-topic";

export function teacherClassDisplayTitle(cls: TeacherClassWithDeck): string {
  return `${cls.period} — ${cls.deckName}`;
}

export function teacherClassSubjectLabel(cls: TeacherClassWithDeck): string {
  const { subject } = parseDeckSubjectTopic({
    name: cls.deckName,
    description: cls.deckDescription,
  });
  return subject || "—";
}

export function buildTeacherClassToolHref(
  toolSuffix: string,
  workspace: TeacherWorkspaceContext,
  deckId: number | null,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  if (deckId != null && deckId > 0) {
    params.set("deckId", String(deckId));
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value.trim() !== "") {
        params.set(key, value);
      }
    }
  }
  const pathname = toolSuffix.startsWith("/") ? toolSuffix : `/${toolSuffix}`;
  return buildTeacherPageCanonicalPath(
    `/teacher${pathname}`,
    workspace.teamId,
    workspace.teamMemberId,
    params,
  );
}

export function buildTeacherClassDeckHref(deckId: number): string {
  return `/decks/${deckId}`;
}

export function teacherClassResourceLinks(
  cls: TeacherClassWithDeck,
  workspace: TeacherWorkspaceContext,
) {
  return {
    lessonPlan: buildTeacherClassToolHref("/lesson-builder", workspace, cls.deckId),
    homework: buildTeacherClassToolHref("/homework", workspace, cls.deckId, {
      sourceType: "deck",
    }),
    cards: buildTeacherClassDeckHref(cls.deckId),
    studyGuide: buildTeacherClassToolHref("/study-guides", workspace, cls.deckId),
    worksheet: buildTeacherClassToolHref("/worksheets", workspace, cls.deckId),
  };
}
