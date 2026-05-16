import { createClerkClient } from "@clerk/backend";
import { redirect } from "next/navigation";
import { getAccessContext } from "@/lib/access";
import { isClerkPlatformAdminRole } from "@/lib/clerk-platform-admin-role";
import {
  isPlatformSuperadminAllowListed,
  reconcilePlatformSuperadminClerkMetadata,
} from "@/lib/platform-superadmin";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export type AdminAccessContext = {
  userId: string;
  callerIsSuperadmin: boolean;
  personalDashboardLink: string;
};

export async function assertAdminDashboardAccess(): Promise<AdminAccessContext> {
  const access = await getAccessContext();
  const { userId, activeTeamPlan, isPro, hasClerkPersonalPro, hasClerkPersonalProPlus } =
    access;
  if (!userId) redirect("/");

  const personalDashboardLink = personalDashboardHrefWithUserPlanQuery({
    userId,
    activeTeamPlan,
    isPro,
    hasClerkPersonalPro,
    hasClerkPersonalProPlus,
  });

  await reconcilePlatformSuperadminClerkMetadata(clerkClient, userId);

  const currentUser = await clerkClient.users.getUser(userId);
  const liveRole = (currentUser.publicMetadata as { role?: string })?.role;
  const canAccessAdmin =
    isClerkPlatformAdminRole(liveRole) || isPlatformSuperadminAllowListed(userId);
  if (!canAccessAdmin) redirect(personalDashboardLink);

  const callerIsSuperadmin =
    isPlatformSuperadminAllowListed(userId) || liveRole === "superadmin";

  return { userId, callerIsSuperadmin, personalDashboardLink };
}
