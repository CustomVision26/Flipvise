import { redirect } from "next/navigation";
import Image from "next/image";
import { createClerkClient } from "@clerk/backend";
import { Users } from "lucide-react";
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
  const { userId, activeTeamPlan, activeEducationTeamPlan, isAdmin } =
    await getAccessContext();
  if (!userId) redirect("/");
  if (isAdmin) {
    redirect("/dashboard");
  }
  const workspacePlan = activeTeamPlan ?? activeEducationTeamPlan;
  if (!workspacePlan) {
    redirect("/pricing");
  }

  const existing = await tryTeamQuery(() => countTeamsForOwner(userId), 0);
  if (existing > 0) {
    redirect(buildTeamAdminPath());
  }

  try {
    await syncTeamSubscriberRoleMetadata(clerkClient, userId);
  } catch {
    // Billing API may be unavailable; webhooks still sync metadata.
  }

  return (
    <div className="create-team-page">
      <div className="create-team-page-card">
        <Image
          src="/artwork/home/team-hero-robot.png"
          alt=""
          width={220}
          height={220}
          className="create-team-page-robot"
        />
        <div className="create-team-page-intro">
          <div className="create-team-page-icon">
            <Users className="h-7 w-7" aria-hidden />
          </div>
          <h1>Create your team</h1>
          <p>
            You subscribed to a team plan. Choose who this workspace is for, then
            fill in the details. Flipvise suggests a unique workspace name from those
            details — you can edit it before creating.
          </p>
        </div>
        <TeamOnboardingWizard planSlug={workspacePlan} />
      </div>
    </div>
  );
}
