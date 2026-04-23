"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/clerk-auth";
import {
  setViewModeSchema,
  viewCookieName,
  type SetViewModeInput,
} from "@/lib/view-mode";

export async function setViewModeAction(data: SetViewModeInput) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = setViewModeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid view mode");

  const cookieStore = await cookies();
  cookieStore.set(viewCookieName(parsed.data.scope), parsed.data.view, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
