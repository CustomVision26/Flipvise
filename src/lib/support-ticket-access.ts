import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { getSupportTicketById, getSupportTicketByIdForUser } from "@/db/queries/support";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import { isPlatformSuperadminAllowListed } from "@/lib/platform-superadmin";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

/** Ticket owner or platform admin may upload chat images for this thread. */
export async function canAccessSupportTicketChat(ticketId: number): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const ticket = await getSupportTicketById(ticketId);
  if (!ticket) return false;

  if (ticket.userId === userId) return true;

  try {
    const caller = await clerkClient.users.getUser(userId);
    const role = (caller.publicMetadata as { role?: string })?.role;
    if (isClerkPlatformAdminRole(role) || isPlatformSuperadminAllowListed(userId)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
