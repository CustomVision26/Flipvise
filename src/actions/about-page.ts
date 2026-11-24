"use server";

import { createClerkClient } from "@clerk/backend";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  getAboutAdminState,
  publishAboutContent,
  recordAboutPhotoUpload,
  saveAboutDraft,
} from "@/db/queries/about-page";
import { parseAboutPageContent, type AboutPageContent } from "@/lib/about-page-content";
import { isClerkPlatformAdminRole, isClerkSuperadminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";
import { uploadAboutLeaderPhotoToS3 } from "@/lib/s3";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

async function requirePlatformAdmin(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const caller = await clerkClient.users.getUser(userId);
  const role = (caller.publicMetadata as { role?: string })?.role;
  if (
    !isClerkPlatformAdminRole(role) &&
    !isClerkSuperadminRole(role) &&
    !isPlatformSuperadminAllowListed(userId)
  ) {
    throw new Error("Forbidden");
  }
  return userId;
}

function validatedContent(input: AboutPageContent) {
  return parseAboutPageContent(input);
}

export async function saveAboutDraftAction(input: AboutPageContent) {
  const userId = await requirePlatformAdmin();
  const parsed = validatedContent(input);
  if (!parsed.ok) return { ok: false as const, message: parsed.error };
  try {
    await saveAboutDraft(userId, parsed.content);
  } catch (error) {
    console.error("[saveAboutDraftAction]", error);
    return {
      ok: false as const,
      message: "The About Us tables are not ready. Run npm run db:ensure-platform-about-settings.",
    };
  }
  revalidatePath("/about");
  revalidatePath("/admin/about");
  return { ok: true as const };
}

export async function publishAboutContentAction(input: AboutPageContent) {
  const userId = await requirePlatformAdmin();
  const parsed = validatedContent(input);
  if (!parsed.ok) return { ok: false as const, message: parsed.error };
  try {
    await publishAboutContent(userId, parsed.content);
  } catch (error) {
    console.error("[publishAboutContentAction]", error);
    return {
      ok: false as const,
      message: "The About Us tables are not ready. Run npm run db:ensure-platform-about-settings.",
    };
  }
  revalidatePath("/about");
  revalidatePath("/admin/about");
  return { ok: true as const };
}

export async function uploadAboutLeaderPhotoAction(formData: FormData) {
  const userId = await requirePlatformAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, message: "Choose a photograph to upload." };
  }
  if (!PHOTO_TYPES.has(file.type)) {
    return { ok: false as const, message: "Photographs must be JPEG, PNG, or WebP." };
  }
  if (file.size <= 0 || file.size > PHOTO_MAX_BYTES) {
    return { ok: false as const, message: "Photographs must be 2 MB or smaller." };
  }
  try {
    const url = await uploadAboutLeaderPhotoToS3({ userId, file });
    await recordAboutPhotoUpload(userId);
    return { ok: true as const, url };
  } catch (error) {
    console.error("[uploadAboutLeaderPhotoAction]", error);
    return { ok: false as const, message: "The photograph could not be uploaded." };
  }
}

export async function getAboutAdminStateAction() {
  await requirePlatformAdmin();
  return getAboutAdminState();
}
