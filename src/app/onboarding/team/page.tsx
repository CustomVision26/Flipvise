import { redirect } from "next/navigation";
import { createClerkClient } from "@clerk/backend";
import { getAccessContext } from "@/lib/access";
import { countTeamsForOwner } from "@/db/queries/teams";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { syncTeamSubscriberRoleMetadata } from "@/lib/team-clerk-metadata";
import { TeamOnboardingWizard } from "@/components/team-onboarding-wizard";
import { buildTeamAdminPath } from "@/lib/team-admin-url";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export default async function TeamOnboardingPage() {
  const { userId, activeTeamPlan, isAdmin } = await getAccessContext();
  if (!userId) redirect("/");
  if (isAdmin) {
    redirect("/dashboard");
  }
  if (!activeTeamPlan) {
    redirect("/pricing");
  }

  const existing = await tryTeamQuery(() => countTeamsForOwner(userId), 0);
  if (existing > 0) {
    redirect(buildTeamAdminPath(userId));
  }

  try {
    await syncTeamSubscriberRoleMetadata(clerkClient, userId);
  } catch {
    // Billing API may be unavailable; webhooks still sync metadata.
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8 max-w-lg mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create your team</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          You subscribed to a team plan. Name your first team, then invite members.
        </p>
      </div>
      <TeamOnboardingWizard planSlug={activeTeamPlan} />
    </div>
  );
}
