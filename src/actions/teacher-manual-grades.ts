"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { hasEducationPlan, isEducationTeamPlanId } from "@/lib/education-plans";
import {
  createTeacherManualGrade,
  deleteTeacherManualGrade,
  updateTeacherManualGrade,
} from "@/db/queries/teacher-manual-grades";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import {
  createTeacherManualGradeSchema,
  updateTeacherManualGradeSchema,
} from "@/lib/teacher-manual-grade-schema";

async function resolveTeamEducationContext(userId: string, teamId: number) {
  const team = await getTeamById(teamId);
  if (!team || !isEducationTeamPlanId(team.planSlug)) {
    throw new Error("Education workspace not found.");
  }

  const members = await listTeamMembers(teamId);
  const canAccess =
    team.ownerUserId === userId ||
    members.some((member) => member.userId === userId);
  if (!canAccess) {
    throw new Error("You do not have access to this workspace.");
  }

  return team;
}

export async function createTeacherManualGradeAction(input: unknown) {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Manual grades require an education plan.",
  );

  const parsed = createTeacherManualGradeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid grade details.");
  }

  const isEducationPlus = ctx.effectivePlanSlug === "education_plus";
  let resolvedTeamId: number | null = null;

  if (parsed.data.teamId != null) {
    const team = await resolveTeamEducationContext(userId, parsed.data.teamId);
    resolvedTeamId = team.id;
  } else if (isEducationPlus) {
    resolvedTeamId = null;
  } else {
    throw new Error("Select an education workspace to record manual grades.");
  }

  const saved = await createTeacherManualGrade(userId, {
    teamId: resolvedTeamId,
    studentName: parsed.data.studentName,
    studentEmail: parsed.data.studentEmail?.trim() ? parsed.data.studentEmail.trim() : null,
    assignmentTitle: parsed.data.assignmentTitle,
    grade: parsed.data.grade,
    maxGrade: parsed.data.maxGrade?.trim() ? parsed.data.maxGrade.trim() : null,
    subject: parsed.data.subject?.trim() ? parsed.data.subject.trim() : null,
    academicYear: parsed.data.academicYear,
    termSemester: parsed.data.termSemester,
    period: parsed.data.period?.trim() ? parsed.data.period.trim() : null,
    notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
    gradeType: parsed.data.gradeType,
  });

  revalidatePath("/teacher/students");

  return {
    id: saved.id,
    studentName: saved.studentName,
    assignmentTitle: saved.assignmentTitle,
    grade: saved.grade,
    maxGrade: saved.maxGrade,
  };
}

export async function updateTeacherManualGradeAction(input: unknown) {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Manual grades require an education plan.",
  );

  const parsed = updateTeacherManualGradeSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid grade details.");
  }

  const saved = await updateTeacherManualGrade(userId, parsed.data.gradeId, {
    studentName: parsed.data.studentName,
    studentEmail: parsed.data.studentEmail?.trim() ? parsed.data.studentEmail.trim() : null,
    assignmentTitle: parsed.data.assignmentTitle,
    grade: parsed.data.grade,
    maxGrade: parsed.data.maxGrade?.trim() ? parsed.data.maxGrade.trim() : null,
    subject: parsed.data.subject?.trim() ? parsed.data.subject.trim() : null,
    academicYear: parsed.data.academicYear,
    termSemester: parsed.data.termSemester,
    period: parsed.data.period?.trim() ? parsed.data.period.trim() : null,
    notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
    gradeType: parsed.data.gradeType,
  });

  if (!saved) {
    throw new Error("Grade record not found.");
  }

  revalidatePath("/teacher/students");

  return {
    id: saved.id,
    studentName: saved.studentName,
    assignmentTitle: saved.assignmentTitle,
    grade: saved.grade,
    maxGrade: saved.maxGrade,
  };
}

export async function deleteTeacherManualGradeAction(gradeId: number) {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Manual grades require an education plan.",
  );

  if (!hasEducationPlan(ctx.effectivePlanSlug)) {
    throw new Error("Manual grades require an education plan.");
  }

  const deleted = await deleteTeacherManualGrade(userId, gradeId);
  if (!deleted) {
    throw new Error("Grade record not found.");
  }

  revalidatePath("/teacher/students");
}
