"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import {
  createTeacherRegisteredStudent,
  deleteTeacherRegisteredStudent,
} from "@/db/queries/teacher-registered-students";
import { registerTeacherStudentSchema } from "@/lib/teacher-registered-student-schema";

function assertEducationPlusPersonalPlan(planSlug: string | null | undefined) {
  if (planSlug !== "education_plus") {
    throw new Error("Registering students is available on Education Plus only.");
  }
}

export async function registerTeacherStudentAction(
  input: unknown,
): Promise<{ id: number; fullName: string; email: string; telephone: string | null }> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Student registration requires an education plan.",
  );
  assertEducationPlusPersonalPlan(ctx.effectivePlanSlug);

  const parsed = registerTeacherStudentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid student details.");
  }

  const saved = await createTeacherRegisteredStudent(userId, {
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    telephone: parsed.data.telephone?.trim() ? parsed.data.telephone.trim() : null,
  });

  revalidatePath("/teacher/students");

  return {
    id: saved.id,
    fullName: saved.fullName,
    email: saved.email,
    telephone: saved.telephone,
  };
}

export async function deleteTeacherRegisteredStudentAction(studentId: number) {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Student registration requires an education plan.",
  );
  assertEducationPlusPersonalPlan(ctx.effectivePlanSlug);

  const deleted = await deleteTeacherRegisteredStudent(userId, studentId);
  if (!deleted) {
    throw new Error("Student not found.");
  }

  revalidatePath("/teacher/students");
}
