import { cache } from "react";
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/** Deduped within a single RSC request — shared by overview stats and tab panels. */
export const getAdminClerkUserList = cache(async () => {
  return clerkClient.users.getUserList({
    limit: 500,
    orderBy: "-created_at",
  });
});

export { clerkClient };
