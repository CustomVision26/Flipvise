import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Inbox } from "lucide-react";
import { currentUser } from "@/lib/clerk-auth";
import { auth } from "@clerk/nextjs/server";
import { TeamInviteInboxSection } from "@/components/team-invite-inbox-section";
import { BillingInboxSection } from "@/components/billing-inbox-section";
import { AffiliateInviteInboxSection } from "@/components/affiliate-invite-inbox-section";
import { buttonVariants } from "@/components/ui/button-variants";
import { getAllAffiliatesByEmailOrUserId } from "@/db/queries/affiliates";
import type { SerializedAffiliate } from "@/lib/admin-dashboard-types";

export default async function DashboardInboxPage() {
  const sessionUser = await currentUser();
  if (!sessionUser) redirect("/");

  const inboxEmail =
    sessionUser.primaryEmailAddress?.emailAddress ?? null;
  if (!inboxEmail) redirect("/dashboard");
  const { userId } = await auth();
  if (!userId) redirect("/");

  const affiliateRows = await getAllAffiliatesByEmailOrUserId(
    inboxEmail,
    userId,
  );

  const allAffiliates: SerializedAffiliate[] = affiliateRows.map((a) => ({
    id: a.id,
    invitedEmail: a.invitedEmail,
    invitedUserId: a.invitedUserId ?? null,
    affiliateName: a.affiliateName,
    planAssigned: a.planAssigned,
    startedAt: a.startedAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    addedByUserId: a.addedByUserId,
    addedByName: a.addedByName,
    status: a.status as "pending" | "active" | "revoked",
    token: a.token ?? null,
    inviteAcceptedAt: a.inviteAcceptedAt ? a.inviteAcceptedAt.toISOString() : null,
    revokedAt: a.revokedAt ? a.revokedAt.toISOString() : null,
    revokedByName: a.revokedByName ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:gap-3 sm:text-3xl">
            <Inbox
              className="size-7 shrink-0 text-foreground sm:size-8"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="min-w-0">Inbox</span>
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Team invitations, affiliate invites, and requests for your account.
          </p>
        </div>
        <Link
          href="/dashboard"
          className={
            buttonVariants({ variant: "outline", size: "sm" }) +
            " inline-flex shrink-0 gap-2 self-start sm:self-auto"
          }
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to dashboard
        </Link>
      </div>

      <AffiliateInviteInboxSection affiliates={allAffiliates} />
      <TeamInviteInboxSection userEmail={inboxEmail} mode="page" />
      <BillingInboxSection userId={userId} userEmail={inboxEmail} />
    </div>
  );
}
