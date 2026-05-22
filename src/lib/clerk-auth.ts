import {
  auth as clerkAuth,
  currentUser as clerkCurrentUser,
} from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  CLEAR_STALE_SESSION_PATH,
  isStaleOrMissingSessionError,
} from "@/lib/clerk-stale-session";

export async function auth(
  ...args: Parameters<typeof clerkAuth>
): Promise<Awaited<ReturnType<typeof clerkAuth>>> {
  try {
    return await clerkAuth(...args);
  } catch (error) {
    if (isStaleOrMissingSessionError(error)) {
      return redirect(CLEAR_STALE_SESSION_PATH);
    }
    throw error;
  }
}

export async function currentUser(
  ...args: Parameters<typeof clerkCurrentUser>
): Promise<Awaited<ReturnType<typeof clerkCurrentUser>>> {
  try {
    return await clerkCurrentUser(...args);
  } catch (error) {
    if (isStaleOrMissingSessionError(error)) {
      return redirect(CLEAR_STALE_SESSION_PATH);
    }
    throw error;
  }
}
