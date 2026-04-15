"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import {
  FREE_UI_THEME_COOKIE,
  setFreeUiThemeSchema,
  type SetFreeUiThemeInput,
} from "@/lib/free-ui-theme";

export async function setFreeUiThemeAction(data: SetFreeUiThemeInput) {
  const { userId, isPro } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");
  if (isPro) throw new Error("Interface colors for free users only.");

  const parsed = setFreeUiThemeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid theme");

  const cookieStore = await cookies();
  if (parsed.data.theme === "neutral") {
    cookieStore.delete(FREE_UI_THEME_COOKIE);
  } else {
    cookieStore.set(FREE_UI_THEME_COOKIE, parsed.data.theme, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  revalidatePath("/", "layout");
}
