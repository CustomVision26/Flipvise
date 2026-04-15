import { auth } from "@clerk/nextjs/server";
import { createClerkClient } from "@clerk/backend";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

type PublicMeta = {
  role?: string;
  adminGranted?: boolean;
  /** Written when admin is granted; used to restore `adminGranted` after admin is removed. */
  preAdminGrantSnapshot?: { adminGranted: boolean };
};

/**
 * Returns the full access context for the current user, combining Clerk
 * Billing subscriptions, admin-granted Pro access, and the admin role itself.
 *
 * Admin accounts receive all Pro features automatically — no manual grant
 * or active subscription is required.
 */
export async function getAccessContext() {
  const { userId, has } = await auth();

  if (!userId) {
    return {
      userId: null as null,
      isPro: false,
      hasUnlimitedDecks: false,
      hasAI: false,
      has75CardsPerDeck: false,
      hasPrioritySupport: false,
      hasCustomColors: false,
      adminGranted: false,
      isAdmin: false,
    };
  }

  const paidPro = has({ plan: "pro" });
  const paidUnlimitedDecks = has({ feature: "unlimited_decks" });
  const paidAI = has({ feature: "ai_flashcard_generation" });
  const paid75Cards = has({ feature: "75_cards_per_deck" });
  const paidPrioritySupport = has({ feature: "priority_support" });
  const paidCustomColors = has({ feature: "12_interface_colors" });

  // Fast path: fully unlocked via Clerk Billing — skip the extra API call.
  if (paidPro && paidUnlimitedDecks && paidAI && paid75Cards && paidPrioritySupport && paidCustomColors) {
    return {
      userId,
      isPro: true,
      hasUnlimitedDecks: true,
      hasAI: true,
      has75CardsPerDeck: true,
      hasPrioritySupport: true,
      hasCustomColors: true,
      adminGranted: false,
      isAdmin: false,
    };
  }

  // Fetch live metadata to check adminGranted flag and admin role.
  const user = await clerkClient.users.getUser(userId);
  const meta = user.publicMetadata as PublicMeta;
  const isAdmin = meta?.role === "admin";
  const adminGranted = meta?.adminGranted === true;

  // Admins automatically receive every Pro feature.
  const unlocked = isAdmin || adminGranted;

  return {
    userId,
    isPro: paidPro || unlocked,
    hasUnlimitedDecks: paidUnlimitedDecks || unlocked,
    hasAI: paidAI || unlocked,
    has75CardsPerDeck: paid75Cards || unlocked,
    hasPrioritySupport: paidPrioritySupport || unlocked,
    hasCustomColors: paidCustomColors || unlocked,
    adminGranted,
    isAdmin,
  };
}
