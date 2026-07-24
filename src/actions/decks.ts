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
import { getTeamById, getDecksForTeam } from "@/db/queries/teams";
import { getAccessContext } from "@/lib/access";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import { isTeamPlanId, limitsForPlan } from "@/lib/team-plans";

const createDeckSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    gradeLevel: z.string().optional(),
    difficultyLevel: z.string().optional(),
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

export type CreateDeckActionResult =
  | { ok: true; deckId: number }
  | { ok: false; error: string };

/**
 * Create a deck. Returns `{ ok, error }` for expected failures — do not throw
 * user-facing errors (production masks thrown Server Action errors as a generic
 * "Server Components render" message).
 */
export async function createDeckAction(
  data: CreateDeckInput,
): Promise<CreateDeckActionResult> {
  try {
    const { userId, maxPersonalDecks } = await getAccessContext();
    if (!userId) {
      return { ok: false, error: "You must be signed in to create a deck." };
    }

    const parsed = createDeckSchema.safeParse(data);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid deck details.",
      };
    }

    const sessionUserId = userId;
    const {
      name,
      description,
      gradeLevel,
      difficultyLevel,
      gradient,
      teamId,
      personalOnly,
      teamWorkspaceOnly,
    } = parsed.data;

    async function insertPersonalDeckForSessionUser(): Promise<
      CreateDeckActionResult
    > {
      const personalCount = await countPersonalDecksForUser(sessionUserId);
      if (personalCount >= maxPersonalDecks) {
        return {
          ok: false,
          error: `Deck limit reached — up to ${maxPersonalDecks} personal deck(s) on your plan. See Pricing to upgrade.`,
        };
      }
      const deckId = await createDeck(
        sessionUserId,
        name,
        description,
        null,
        gradient,
        gradeLevel,
        difficultyLevel,
        sessionUserId,
      );
      return { ok: true, deckId };
    }

    async function insertTeamDeckForTeamId(
      tid: number,
    ): Promise<CreateDeckActionResult> {
      const team = await getTeamById(tid);
      if (!team) return { ok: false, error: "Invalid team." };
      if (team.ownerUserId !== sessionUserId) {
        return { ok: false, error: "You don't have permission to create a team deck." };
      }
      if (isTeamPlanId(team.planSlug)) {
        const limits = limitsForPlan(team.planSlug);
        const inWorkspace = await getDecksForTeam(team.id, team.ownerUserId);
        if (inWorkspace.length >= limits.maxDecksPerWorkspace) {
          return {
            ok: false,
            error: `Workspace deck limit reached — up to ${limits.maxDecksPerWorkspace} decks in this workspace on your plan. See Pricing to upgrade.`,
          };
        }
      }
      const deckId = await createDeck(
        team.ownerUserId,
        name,
        description,
        tid,
        gradient,
        gradeLevel,
        difficultyLevel,
        sessionUserId,
      );
      return { ok: true, deckId };
    }

    let result: CreateDeckActionResult;
    if (teamWorkspaceOnly === true && teamId !== undefined) {
      result = await insertTeamDeckForTeamId(teamId);
    } else if (personalOnly === true) {
      result = await insertPersonalDeckForSessionUser();
    } else if (teamId !== undefined) {
      result = await insertTeamDeckForTeamId(teamId);
    } else {
      result = await insertPersonalDeckForSessionUser();
    }

    if (!result.ok) return result;

    revalidatePath("/dashboard");
    if (teamId !== undefined || teamWorkspaceOnly === true) {
      revalidatePath("/dashboard/team-admin", "layout");
    }

    return result;
  } catch (error) {
    console.error("[createDeckAction]", error);
    return {
      ok: false,
      error: "Couldn't create the deck. Please try again.",
    };
  }
}

const updateDeckSchema = z.object({
  deckId: z.number().int().positive(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  gradeLevel: z.string().optional(),
  difficultyLevel: z.string().optional(),
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
    parsed.data.gradeLevel,
    parsed.data.difficultyLevel,
  );

  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard");
}

const uploadDeckCoverImageSchema = z.object({
  deckId: z.number().int().positive(),
});

type UploadDeckCoverImageInput = z.infer<typeof uploadDeckCoverImageSchema>;

/**
 * Upload or replace the deck cover — allowed when {@link deckHasTeamTierProFeatures} is true
 * for the subscriber’s deck (`team-tier` workspaces).
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
  if (!(await deckHasTeamTierProFeatures(deck))) {
    throw new Error(
      "Cover images are available on decks for subscribers with a team-tier workspace.",
    );
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

/** Remove the subscriber’s team-tier deck cover image. */
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
  if (!(await deckHasTeamTierProFeatures(deck))) {
    throw new Error(
      "Cover images are available on decks for subscribers with a team-tier workspace.",
    );
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
