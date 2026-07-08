"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import {
  deleteSavedHomeworkAssignmentById,
  getSavedHomeworkAssignmentById,
} from "@/db/queries/saved-homework";
import {
  deleteSavedLessonPlanById,
  getSavedLessonPlanById,
} from "@/db/queries/saved-lesson-plans";
import {
  deleteTeacherClassById,
  getTeacherClassById,
} from "@/db/queries/teacher-classes";
import { getTeamById } from "@/db/queries/teams";
import { deleteFromS3 } from "@/lib/s3";

const deleteTeacherResourceSchema = z.object({
  resourceType: z.enum(["lessonPlans", "homework"]),
  resourceId: z.number().int().positive(),
  teamId: z.number().int().positive().nullable(),
});

const deleteTeacherClassSchema = z.object({
  classId: z.number().int().positive(),
  teamId: z.number().int().positive().nullable(),
});

async function assertCanManageSavedResource(
  viewerUserId: string,
  ownerUserId: string,
  teamId: number | null,
): Promise<void> {
  if (ownerUserId === viewerUserId) return;

  if (teamId == null) {
    throw new Error("Forbidden");
  }

  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== viewerUserId) {
    throw new Error("Forbidden");
  }
}

export async function deleteTeacherResourceAction(
  data: z.infer<typeof deleteTeacherResourceSchema>,
) {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Teacher resources require an Education plan or workspace access.",
  );

  const parsed = deleteTeacherResourceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  if (parsed.data.resourceType === "lessonPlans") {
    const row = await getSavedLessonPlanById(parsed.data.resourceId);
    if (!row) throw new Error("Lesson plan not found");

    await assertCanManageSavedResource(userId, row.userId, parsed.data.teamId);

    if (row.pdfUrl) {
      try {
        await deleteFromS3(row.pdfUrl);
      } catch {
        // proceed with DB delete even if object removal fails
      }
    }

    await deleteSavedLessonPlanById(parsed.data.resourceId);
  } else {
    const row = await getSavedHomeworkAssignmentById(parsed.data.resourceId);
    if (!row) throw new Error("Homework not found");

    await assertCanManageSavedResource(userId, row.userId, parsed.data.teamId);

    if (row.pdfUrl) {
      try {
        await deleteFromS3(row.pdfUrl);
      } catch {
        // proceed with DB delete even if object removal fails
      }
    }

    await deleteSavedHomeworkAssignmentById(parsed.data.resourceId);
  }

  revalidatePath("/teacher/resources");
}

export async function deleteTeacherClassAction(
  data: z.infer<typeof deleteTeacherClassSchema>,
) {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Teacher classes require an Education plan or workspace access.",
  );

  const parsed = deleteTeacherClassSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const row = await getTeacherClassById(parsed.data.classId);
  if (!row) throw new Error("Class not found");

  await assertCanManageSavedResource(userId, row.userId, parsed.data.teamId);
  await deleteTeacherClassById(parsed.data.classId);

  revalidatePath("/teacher/classes");
}
