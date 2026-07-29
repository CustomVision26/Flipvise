"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import { requireTeacherToolsAccess } from "@/lib/teacher-access";
import {
  deleteSavedHomeworkAssignmentById,
  getSavedHomeworkAssignmentById,
  renameSavedHomeworkLabelById,
} from "@/db/queries/saved-homework";
import {
  deleteSavedLessonPlanById,
  getSavedLessonPlanById,
  renameSavedLessonPlanTitleById,
} from "@/db/queries/saved-lesson-plans";
import {
  deleteSavedWorksheetById,
  getSavedWorksheetById,
  renameSavedWorksheetLabelById,
} from "@/db/queries/saved-worksheets";
import {
  deleteSavedStudyGuideById,
  getSavedStudyGuideById,
  renameSavedStudyGuideLabelById,
} from "@/db/queries/saved-study-guides";
import {
  deleteSavedQuizById,
  getSavedQuizById,
} from "@/db/queries/saved-quizzes";
import {
  deleteTeacherClassById,
  getTeacherClassById,
} from "@/db/queries/teacher-classes";
import { getTeamById } from "@/db/queries/teams";
import { deleteFromS3 } from "@/lib/s3";

const teacherResourceTypeSchema = z.enum([
  "lessonPlans",
  "homework",
  "worksheets",
  "studyGuides",
  "quizzes",
]);

const deleteTeacherResourceSchema = z.object({
  resourceType: teacherResourceTypeSchema,
  resourceId: z.number().int().positive(),
  teamId: z.number().int().positive().nullable(),
});

const renameTeacherResourceSchema = z.object({
  resourceType: z.enum(["lessonPlans", "homework", "worksheets", "studyGuides"]),
  resourceId: z.number().int().positive(),
  teamId: z.number().int().positive().nullable(),
  title: z.string().trim().min(1).max(512),
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

export async function renameTeacherResourceAction(
  data: z.infer<typeof renameTeacherResourceSchema>,
) {
  const ctx = await getAccessContext();
  const { userId } = await requireTeacherToolsAccess(
    ctx,
    "Teacher resources require an Education plan or workspace access.",
  );

  const parsed = renameTeacherResourceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { resourceType, resourceId, teamId, title } = parsed.data;
  const maxLen = resourceType === "lessonPlans" ? 512 : 255;
  if (title.length > maxLen) {
    throw new Error(`Name must be ${maxLen} characters or fewer.`);
  }

  if (resourceType === "lessonPlans") {
    const row = await getSavedLessonPlanById(resourceId);
    if (!row) throw new Error("Lesson plan not found");
    await assertCanManageSavedResource(userId, row.userId, teamId);
    const updated = await renameSavedLessonPlanTitleById(resourceId, title);
    if (!updated) throw new Error("Could not rename lesson plan");
  } else if (resourceType === "homework") {
    const row = await getSavedHomeworkAssignmentById(resourceId);
    if (!row) throw new Error("Homework not found");
    await assertCanManageSavedResource(userId, row.userId, teamId);
    const updated = await renameSavedHomeworkLabelById(resourceId, title);
    if (!updated) throw new Error("Could not rename homework");
  } else if (resourceType === "worksheets") {
    const row = await getSavedWorksheetById(resourceId);
    if (!row) throw new Error("Worksheet not found");
    await assertCanManageSavedResource(userId, row.userId, teamId);
    const updated = await renameSavedWorksheetLabelById(resourceId, title);
    if (!updated) throw new Error("Could not rename worksheet");
  } else {
    const row = await getSavedStudyGuideById(resourceId);
    if (!row) throw new Error("Study guide not found");
    await assertCanManageSavedResource(userId, row.userId, teamId);
    const updated = await renameSavedStudyGuideLabelById(resourceId, title);
    if (!updated) throw new Error("Could not rename study guide");
  }

  revalidatePath("/teacher/resources");
  revalidatePath("/teacher/lesson-builder");
  revalidatePath("/teacher/homework");
  revalidatePath("/teacher/worksheets");
  revalidatePath("/teacher/study-guides");
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
    revalidatePath("/teacher/lesson-builder");
  } else if (parsed.data.resourceType === "homework") {
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
  } else if (parsed.data.resourceType === "worksheets") {
    const row = await getSavedWorksheetById(parsed.data.resourceId);
    if (!row) throw new Error("Worksheet not found");

    await assertCanManageSavedResource(userId, row.userId, parsed.data.teamId);

    if (row.worksheetPdfUrl) {
      try {
        await deleteFromS3(row.worksheetPdfUrl);
      } catch {
        // proceed with DB delete even if object removal fails
      }
    }

    if (row.answerKeyPdfUrl) {
      try {
        await deleteFromS3(row.answerKeyPdfUrl);
      } catch {
        // proceed with DB delete even if object removal fails
      }
    }

    await deleteSavedWorksheetById(parsed.data.resourceId);
  } else if (parsed.data.resourceType === "studyGuides") {
    const row = await getSavedStudyGuideById(parsed.data.resourceId);
    if (!row) throw new Error("Study guide not found");

    await assertCanManageSavedResource(userId, row.userId, parsed.data.teamId);

    if (row.pdfUrl) {
      try {
        await deleteFromS3(row.pdfUrl);
      } catch {
        // proceed with DB delete even if object removal fails
      }
    }

    await deleteSavedStudyGuideById(parsed.data.resourceId);
  } else {
    const row = await getSavedQuizById(parsed.data.resourceId);
    if (!row) throw new Error("Quiz sheet not found");

    await assertCanManageSavedResource(userId, row.userId, parsed.data.teamId);

    if (row.questionSheetPdfUrl) {
      try {
        await deleteFromS3(row.questionSheetPdfUrl);
      } catch {
        // proceed with DB delete even if object removal fails
      }
    }

    if (row.answerKeyPdfUrl) {
      try {
        await deleteFromS3(row.answerKeyPdfUrl);
      } catch {
        // proceed with DB delete even if object removal fails
      }
    }

    await deleteSavedQuizById(parsed.data.resourceId);
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
