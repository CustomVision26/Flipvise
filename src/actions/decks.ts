"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDeck, updateDeck, deleteDeck, getDecksByUser } from "@/db/queries/decks";
import { getAccessContext } from "@/lib/access";


const createDeckSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type CreateDeckInput = z.infer<typeof createDeckSchema>;

export async function createDeckAction(data: CreateDeckInput) {
  const { userId, hasUnlimitedDecks } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  if (!hasUnlimitedDecks) {
    const existingDecks = await getDecksByUser(userId);
    if (existingDecks.length >= 3) {
      throw new Error("Free plan limit reached. Upgrade to Pro for unlimited decks.");
    }
  }

  await createDeck(userId, parsed.data.name, parsed.data.description);

  revalidatePath("/dashboard");
}

const updateDeckSchema = z.object({
  deckId: z.number().int().positive(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

type UpdateDeckInput = z.infer<typeof updateDeckSchema>;

export async function updateDeckAction(data: UpdateDeckInput) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await updateDeck(
    parsed.data.deckId,
    userId,
    parsed.data.name,
    parsed.data.description,
  );

  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard");
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

  await deleteDeck(parsed.data.deckId, userId);

  revalidatePath("/dashboard");
}
