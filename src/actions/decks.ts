"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  countPersonalDecksForUser,
  createDeck,
  deleteDeck,
  isMissingDeckCoverColumnError,
  setDeckCoverImageUrl,
  updateDeck,
} from "@/db/queries/decks";
import { uploadToS3, deleteFromS3 } from "@/lib/s3";
import { getTeamById, getMemberRecord } from "@/db/queries/teams";
import { getAccessContext } from "@/lib/access";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";

const createDeckSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    gradient: z.string().optional(),
    teamId: z.number().int().positive().optional(),
    /** When true, always create a personal deck for the session user (`teamId` ignored). */
    personalOnly: z.literal(true).optional(),
    /**
     * Team dashboard / team workspace UI — must create a team deck (owner `userId` + `teamId`);
     * never a personal deck. Requires `teamId`.
     */
    teamWorkspaceOnly: z.literal(true).optional(),
  })
  .refine(
    (d) => d.teamWorkspaceOnly !== true || d.teamId !== undefined,
    { message: "teamId is required for team workspace", path: ["teamId"] },
  )
  .refine(
    (d) => !(d.teamWorkspaceOnly === true && d.personalOnly === true),
    { message: "Cannot mix personal and team workspace flags", path: ["personalOnly"] },
  );

type CreateDeckInput = z.infer<typeof createDeckSchema>;

export async function createDeckAction(
  data: CreateDeckInput,
): Promise<{ deckId: number }> {
  const { userId, hasUnlimitedDecks } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const sessionUserId = userId;
  const { name, description, gradient, teamId, personalOnly, teamWorkspaceOnly } = parsed.data;

  async function insertPersonalDeckForSessionUser(): Promise<number> {
    if (!hasUnlimitedDecks) {
      const personalCount = await countPersonalDecksForUser(sessionUserId);
      if (personalCount >= 3) {
        throw new Error("Free plan limit reached. Upgrade to Pro for unlimited decks.");
      }
    }
    return createDeck(sessionUserId, name, description, null, gradient);
  }

  async function insertTeamDeckForTeamId(tid: number): Promise<number> {
    const team = await getTeamById(tid);
    if (!team) throw new Error("Invalid team");
    const isOwner = team.ownerUserId === sessionUserId;
    const membership = await getMemberRecord(tid, sessionUserId);
    const isTeamAdmin = membership?.role === "team_admin";
    if (!isOwner && !isTeamAdmin) throw new Error("Forbidden");
    return createDeck(team.ownerUserId, name, description, tid, gradient);
  }

  let deckId: number;
  if (teamWorkspaceOnly === true && teamId !== undefined) {
    deckId = await insertTeamDeckForTeamId(teamId);
  } else if (personalOnly === true) {
    deckId = await insertPersonalDeckForSessionUser();
  } else if (teamId !== undefined) {
    deckId = await insertTeamDeckForTeamId(teamId);
  } else {
    deckId = await insertPersonalDeckForSessionUser();
  }

  revalidatePath("/dashboard");
  if (teamId !== undefined || teamWorkspaceOnly === true) {
    revalidatePath("/dashboard/team-admin", "layout");
  }

  return { deckId };
}

const updateDeckSchema = z.object({
  deckId: z.number().int().positive(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  gradient: z.string().optional(),
});

type UpdateDeckInput = z.infer<typeof updateDeckSchema>;

export async function updateDeckAction(data: UpdateDeckInput) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Forbidden");
  }

  await updateDeck(
    parsed.data.deckId,
    bundle.deck.userId,
    parsed.data.name,
    parsed.data.description,
    parsed.data.gradient,
  );

  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard");
}

const uploadDeckCoverImageSchema = z.object({
  deckId: z.number().int().positive(),
});

type UploadDeckCoverImageInput = z.infer<typeof uploadDeckCoverImageSchema>;

/**
 * Upload a cover image for a **team workspace** deck (`teamId` set).
 * Replaces any existing cover; persists immediately.
 */
export async function uploadDeckCoverImageAction(
  data: UploadDeckCoverImageInput,
  formData: FormData,
): Promise<{ url: string }> {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = uploadDeckCoverImageSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Forbidden");
  }

  const deck = bundle.deck;
  if (deck.teamId === null) {
    throw new Error("Cover image is only available for team workspace decks.");
  }

  const file = formData.get("image");
  if (!(file instanceof File)) throw new Error("No image file provided");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5 MB");
  }

  const url = await uploadToS3({
    userId,
    deckId: parsed.data.deckId,
    file,
    addRandomSuffix: true,
  });

  if (deck.coverImageUrl) {
    try {
      await deleteFromS3(deck.coverImageUrl);
    } catch {
      // ignore — old object may already be gone
    }
  }

  try {
    await setDeckCoverImageUrl(parsed.data.deckId, deck.userId, url);
  } catch (e) {
    try {
      await deleteFromS3(url);
    } catch {
      // ignore orphan cleanup failure
    }
    if (isMissingDeckCoverColumnError(e)) {
      throw new Error(
        "This database is missing the deck cover column. Run `npm run db:ensure-deck-cover-column` or `npm run db:push:local`, then try again.",
      );
    }
    throw e;
  }

  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team-admin", "layout");

  return { url };
}

const removeDeckCoverImageSchema = z.object({
  deckId: z.number().int().positive(),
});

type RemoveDeckCoverImageInput = z.infer<typeof removeDeckCoverImageSchema>;

/** Remove the cover image from a team workspace deck. */
export async function removeDeckCoverImageAction(data: RemoveDeckCoverImageInput) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = removeDeckCoverImageSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Forbidden");
  }

  const deck = bundle.deck;
  if (deck.teamId === null) {
    throw new Error("Cover image is only available for team workspace decks.");
  }

  if (deck.coverImageUrl) {
    try {
      await deleteFromS3(deck.coverImageUrl);
    } catch {
      // ignore
    }
  }

  try {
    await setDeckCoverImageUrl(parsed.data.deckId, deck.userId, null);
  } catch (e) {
    if (isMissingDeckCoverColumnError(e)) {
      throw new Error(
        "This database is missing the deck cover column. Run `npm run db:ensure-deck-cover-column` or `npm run db:push:local`, then try again.",
      );
    }
    throw e;
  }

  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/team-admin", "layout");
}

const deleteDeckSchema = z.object({
  deckId: z.number().int().positive(),
});

type DeleteDeckInput = z.infer<typeof deleteDeckSchema>;

export async function deleteDeckAction(data: DeleteDeckInput) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deleteDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const bundle = await getDeckWithViewerAccess(parsed.data.deckId, userId);
  if (!bundle || !canEditDeckContent(bundle.access)) {
    throw new Error("Forbidden");
  }

  await deleteDeck(parsed.data.deckId, bundle.deck.userId);

  revalidatePath("/dashboard");
}
