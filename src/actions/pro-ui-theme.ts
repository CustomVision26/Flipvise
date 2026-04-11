"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import {
  PRO_UI_THEME_COOKIE,
  setProUiThemeSchema,
  type SetProUiThemeInput,
} from "@/lib/pro-ui-theme";

export async function setProUiThemeAction(data: SetProUiThemeInput) {
  const { userId, isPro } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");
  if (!isPro) throw new Error("Interface colors are available on the Pro plan.");

  const parsed = setProUiThemeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid theme");

  const cookieStore = await cookies();
  if (parsed.data.theme === "neutral") {
    cookieStore.delete(PRO_UI_THEME_COOKIE);
  } else {
    cookieStore.set(PRO_UI_THEME_COOKIE, parsed.data.theme, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  revalidatePath("/", "layout");
}
