"use server";

import { z } from "zod";
import { auth } from "@/lib/clerk-auth";
import {
  applyPlanReconciliationChoices,
  getPendingPlanReconciliationSession,
} from "@/db/queries/plan-reconciliation";

const resourceActionSchema = z.enum(["keep", "inactive", "delete"]);

const submitSchema = z.object({
  sessionId: z.number().int().positive(),
  teams: z
    .array(
      z.object({
        teamId: z.number().int().positive(),
        action: resourceActionSchema,
        members: z.array(
          z.object({
            memberUserId: z.string().min(1),
            action: resourceActionSchema,
          }),
        ),
        decks: z.array(
          z.object({
            deckId: z.number().int().positive(),
            action: resourceActionSchema,
          }),
        ),
      }),
    )
    .optional(),
  personalDecks: z
    .array(
      z.object({
        deckId: z.number().int().positive(),
        action: resourceActionSchema,
      }),
    )
    .optional(),
});

export async function submitPlanReconciliationAction(
  data: z.infer<typeof submitSchema>,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = submitSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const session = await getPendingPlanReconciliationSession(userId);
  if (!session || session.id !== parsed.data.sessionId) {
    throw new Error("Reconciliation session not found");
  }

  const result = await applyPlanReconciliationChoices(
    userId,
    session,
    parsed.data,
  );
  if (!result.ok) {
    throw new Error(result.message);
  }

  return { ok: true as const };
}
