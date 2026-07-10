import {
  buildTeacherPageCanonicalPath,
  buildTeacherSubPath,
  type TeacherWorkspaceContext,
} from "@/lib/teacher-url";
import type { TeacherClassWithDeck } from "@/db/queries/teacher-classes";
import { parseDeckSubjectTopic } from "@/lib/deck-subject-topic";

import {
  TEACHER_CLASS_DAY_OPTIONS,
} from "@/lib/teacher-class-form";

function isStoredPlanPeriodDay(day: string): number | null {
  const value = Number(day);
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    return null;
  }
  if (TEACHER_CLASS_DAY_OPTIONS.includes(day as (typeof TEACHER_CLASS_DAY_OPTIONS)[number])) {
    return null;
  }
  return value;
}

export function resolveTeacherClassPlanPeriod(
  cls: TeacherClassWithDeck,
  planPeriodDaysByDeckId?: Record<number, number>,
): number | null {
  const fromDeck = planPeriodDaysByDeckId?.[cls.deckId];
  if (fromDeck != null) {
    return fromDeck;
  }
  return isStoredPlanPeriodDay(cls.day);
}

export function teacherClassWeekDisplay(
  cls: TeacherClassWithDeck,
  planPeriodDaysByDeckId?: Record<number, number>,
): string {
  const planPeriod = resolveTeacherClassPlanPeriod(cls, planPeriodDaysByDeckId);
  if (planPeriod != null) {
    return `${cls.week} · No of Class : ${planPeriod}`;
  }
  return cls.week;
}

export function buildTeacherClassDisplayTitle(
  termSemester: string,
  week: string,
  deckName: string,
): string {
  const term = termSemester.trim();
  const weekLabel = week.trim();
  const deck = deckName.trim();

  if (term && weekLabel && deck) {
    return `${term} · ${weekLabel} — ${deck}`;
  }
  if (term && weekLabel) {
    return `${term} · ${weekLabel}`;
  }
  if (term && deck) {
    return `${term} — ${deck}`;
  }
  return deck || weekLabel || term || "Class";
}

export function teacherClassDisplayTitle(cls: TeacherClassWithDeck): string {
  return buildTeacherClassDisplayTitle(cls.termSemester, cls.week, cls.deckName);
}

export function registeredStudentClassDisplayTitle(
  student: {
    classId: number | null;
    classTermSemester?: string | null;
    classWeek?: string | null;
    classDeckName?: string | null;
  },
  personalClasses: TeacherClassWithDeck[],
): string | null {
  if (student.classTermSemester && student.classWeek && student.classDeckName) {
    return buildTeacherClassDisplayTitle(
      student.classTermSemester,
      student.classWeek,
      student.classDeckName,
    );
  }

  if (student.classId != null) {
    const cls = personalClasses.find((item) => item.id === student.classId);
    if (cls) return teacherClassDisplayTitle(cls);
  }

  return null;
}

export function formatRegisteredStudentWithClassLabel(
  student: {
    fullName: string;
    email: string;
    classId: number | null;
    classTermSemester?: string | null;
    classWeek?: string | null;
    classDeckName?: string | null;
  },
  personalClasses: TeacherClassWithDeck[],
): string {
  const email = student.email.trim();
  const base = email ? `${student.fullName} · ${email}` : student.fullName;
  const classTitle = registeredStudentClassDisplayTitle(student, personalClasses);

  return classTitle ? `${base} · ${classTitle}` : base;
}

export function resolveRegisteredStudentClass(
  student: {
    classId: number | null;
    classDeckId?: number | null;
    classTermSemester?: string | null;
    classWeek?: string | null;
    classDeckName?: string | null;
    classAcademicYear?: string | null;
    classPeriod?: string | null;
    userId?: string;
  },
  personalClasses: TeacherClassWithDeck[],
): TeacherClassWithDeck | null {
  if (student.classId != null) {
    const cls = personalClasses.find((item) => item.id === student.classId);
    if (cls) return cls;
  }

  if (
    student.classDeckId != null &&
    student.classTermSemester &&
    student.classWeek &&
    student.classDeckName
  ) {
    return {
      id: student.classId ?? 0,
      userId: student.userId ?? "",
      teamId: null,
      deckId: student.classDeckId,
      academicYear: student.classAcademicYear ?? "",
      termSemester: student.classTermSemester,
      week: student.classWeek,
      day: "",
      period: student.classPeriod ?? "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deckName: student.classDeckName,
      deckGradeLevel: null,
      deckDescription: null,
    };
  }

  return null;
}

export function resolveRegisteredStudentClassDeckId(
  student: {
    classId: number | null;
    classDeckId?: number | null;
    classTermSemester?: string | null;
    classWeek?: string | null;
    classDeckName?: string | null;
    classAcademicYear?: string | null;
    classPeriod?: string | null;
    userId?: string;
  },
  personalClasses: TeacherClassWithDeck[],
): number | null {
  const cls = resolveRegisteredStudentClass(student, personalClasses);
  return cls?.deckId ?? student.classDeckId ?? null;
}

export function formatQuizResultOptionTitle(
  cls: TeacherClassWithDeck,
  percent: number,
  savedAt: Date,
): string {
  const when = savedAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${quizTitleForTeacherClass(cls)} — ${percent}% (${when})`;
}

/** Quiz picker label scoped to the student's class (avoids ambiguity across subjects). */
export function quizTitleForTeacherClass(
  cls: TeacherClassWithDeck,
  savedQuizTitle?: string | null,
): string {
  const classLabel = teacherClassDisplayTitle(cls);
  const trimmed = savedQuizTitle?.trim();
  if (!trimmed) return `${classLabel} Quiz`;
  if (trimmed.toLowerCase().endsWith(" quiz")) {
    return `${classLabel} Quiz`;
  }
  return `${classLabel} — ${trimmed}`;
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
