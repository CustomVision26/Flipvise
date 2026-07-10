"use server";

import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import { getTeacherClassById } from "@/db/queries/teacher-classes";
import { getTeamById, listTeamMembers } from "@/db/queries/teams";
import {
  createTeacherRegisteredStudent,
  deleteTeacherRegisteredStudent,
  updateTeacherRegisteredStudent,
} from "@/db/queries/teacher-registered-students";
import { resolveWorkspaceStudentInviteeForTeam } from "@/db/queries/teacher-workspace-student-invitees";
import { isEducationTeamPlanId } from "@/lib/education-plans";
import {
  registerTeacherStudentSchema,
  registerWorkspaceInviteeStudentSchema,
  updateTeacherStudentSchema,
} from "@/lib/teacher-registered-student-schema";

function assertEducationPlusPersonalPlan(planSlug: string | null | undefined) {
  if (planSlug !== "education_plus") {
    throw new Error("Manual student registration is available on Education Plus only.");
  }
}

async function resolvePersonalClassForUser(userId: string, classId: number) {
  const teacherClass = await getTeacherClassById(classId);
  if (!teacherClass || teacherClass.userId !== userId || teacherClass.teamId != null) {
    throw new Error("Selected class was not found.");
  }
  return teacherClass;
}

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

async function resolveWorkspaceClassForTeam(teamId: number, classId: number) {
  const teacherClass = await getTeacherClassById(classId);
  if (!teacherClass || teacherClass.teamId !== teamId) {
    throw new Error("Selected class was not found.");
  }
  return teacherClass;
}

export async function registerTeacherStudentAction(
  input: unknown,
): Promise<{
  id: number;
  fullName: string;
  email: string;
  telephone: string | null;
  classId: number | null;
}> {
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

  let classId: number | null = null;
  if (parsed.data.classId != null) {
    await resolvePersonalClassForUser(userId, parsed.data.classId);
    classId = parsed.data.classId;
  }

  const saved = await createTeacherRegisteredStudent(userId, {
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    telephone: parsed.data.telephone?.trim() ? parsed.data.telephone.trim() : null,
    classId,
  });

  revalidatePath("/teacher/students");

  return {
    id: saved.id,
    fullName: saved.fullName,
    email: saved.email,
    telephone: saved.telephone,
    classId: saved.classId,
  };
}

export async function registerWorkspaceInviteeStudentAction(
  input: unknown,
): Promise<{
  id: number;
  fullName: string;
  email: string;
  telephone: string | null;
  classId: number | null;
}> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Student registration requires an education plan.",
  );

  const parsed = registerWorkspaceInviteeStudentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid student details.");
  }

  await resolveTeamEducationContext(userId, parsed.data.teamId);

  const invitee = await resolveWorkspaceStudentInviteeForTeam(
    parsed.data.teamId,
    parsed.data.inviteeKey,
  );
  if (!invitee) {
    throw new Error("Selected workspace student was not found.");
  }
  if (!invitee.email.trim()) {
    throw new Error("Selected workspace student does not have an email on file.");
  }

  let classId: number | null = null;
  if (parsed.data.classId != null) {
    await resolveWorkspaceClassForTeam(parsed.data.teamId, parsed.data.classId);
    classId = parsed.data.classId;
  }

  const saved = await createTeacherRegisteredStudent(userId, {
    fullName: invitee.label,
    email: invitee.email.trim().toLowerCase(),
    telephone: null,
    classId,
  });

  revalidatePath("/teacher/students");

  return {
    id: saved.id,
    fullName: saved.fullName,
    email: saved.email,
    telephone: saved.telephone,
    classId: saved.classId,
  };
}

export async function updateTeacherRegisteredStudentAction(
  input: unknown,
): Promise<{
  id: number;
  fullName: string;
  email: string;
  telephone: string | null;
  classId: number | null;
}> {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Student registration requires an education plan.",
  );

  const parsed = updateTeacherStudentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid student details.");
  }

  const isEducationPlus = ctx.effectivePlanSlug === "education_plus";

  let classId: number | null = null;
  if (parsed.data.classId != null) {
    if (isEducationPlus) {
      await resolvePersonalClassForUser(userId, parsed.data.classId);
    } else {
      const teacherClass = await getTeacherClassById(parsed.data.classId);
      if (!teacherClass?.teamId) {
        throw new Error("Selected class was not found.");
      }
      await resolveTeamEducationContext(userId, teacherClass.teamId);
      await resolveWorkspaceClassForTeam(teacherClass.teamId, parsed.data.classId);
    }
    classId = parsed.data.classId;
  }

  const saved = await updateTeacherRegisteredStudent(userId, parsed.data.studentId, {
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    telephone: parsed.data.telephone?.trim() ? parsed.data.telephone.trim() : null,
    classId,
  });

  if (!saved) {
    throw new Error("Student not found.");
  }

  revalidatePath("/teacher/students");

  return {
    id: saved.id,
    fullName: saved.fullName,
    email: saved.email,
    telephone: saved.telephone,
    classId: saved.classId,
  };
}

export async function deleteTeacherRegisteredStudentAction(studentId: number) {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Student registration requires an education plan.",
  );

  const deleted = await deleteTeacherRegisteredStudent(userId, studentId);
  if (!deleted) {
    throw new Error("Student not found.");
  }

  revalidatePath("/teacher/students");
}
