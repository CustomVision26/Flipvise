import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Inbox } from "lucide-react";
import { currentUser } from "@/lib/clerk-auth";
import { auth } from "@clerk/nextjs/server";

// Data sources
import { getQuizResultInboxForUser } from "@/db/queries/quiz-results";
import { getTeamsByIds, listTeamMembersByTeamIds } from "@/db/queries/teams";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import { listTeamInvitationsForInviteeEmail } from "@/db/queries/teams";
import { isTeamInviteExpired } from "@/lib/team-invite-expiry";
import { resolveTeamInviteInboxOutcome } from "@/lib/team-invite-inbox-outcome";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { listBillingInvoicesForUser } from "@/db/queries/billing";
import { getAllAffiliatesByEmailOrUserId } from "@/db/queries/affiliates";
import { getInboxReadsForUser } from "@/db/queries/inbox-reads";
import { listAdminPlanAssignmentInboxLogsForUser } from "@/db/queries/admin";
import { isAffiliateInviteExpired } from "@/lib/affiliate-invite-expiry";
import { buildAffiliateNoticeInboxItems } from "@/lib/affiliate-inbox-notices";
import { adminPlanAssignmentLogToInboxItem } from "@/lib/admin-plan-inbox-item";

// UI
import { buttonVariants } from "@/components/ui/button-variants";
import { InboxUnifiedClient } from "@/components/inbox-unified-client";
import type { UnifiedInboxItem } from "@/lib/inbox-item-types";
import type { QuizResultSummary } from "@/components/view-quiz-result-dialog";

export default async function DashboardInboxPage() {
  const sessionUser = await currentUser();
  if (!sessionUser) redirect("/");

  const inboxEmail = sessionUser.primaryEmailAddress?.emailAddress ?? null;
  if (!inboxEmail) redirect("/dashboard");

  const { userId } = await auth();
  if (!userId) redirect("/");

  // ── Fetch everything in parallel ──────────────────────────────────────────
  const [
    quizEntries,
    teamInviteRows,
    billingRows,
    affiliateRows,
    adminPlanLogRows,
    readSet,
  ] = await Promise.all([
    getQuizResultInboxForUser(userId),
    tryTeamQuery(() => listTeamInvitationsForInviteeEmail(inboxEmail), []),
    listBillingInvoicesForUser(userId, inboxEmail),
    getAllAffiliatesByEmailOrUserId(inboxEmail, userId),
    listAdminPlanAssignmentInboxLogsForUser(userId, 100),
    getInboxReadsForUser(userId),
  ]);

  // ── Resolve team context for quiz results ─────────────────────────────────
  const uniqueTeamIds = [
    ...new Set(
      quizEntries.map((e) => e.quizResult.teamId).filter((id): id is number => id !== null),
    ),
  ];
  const [teamsRows, memberRows] = await Promise.all([
    getTeamsByIds(uniqueTeamIds),
    listTeamMembersByTeamIds(uniqueTeamIds),
  ]);
  const teamMap = new Map(teamsRows.map((t) => [t.id, t]));
  const memberRoleMap = new Map(
    memberRows.map((m) => [`${m.teamId}-${m.userId}`, m.role as string]),
  );

  // ── Batch Clerk user lookups ──────────────────────────────────────────────
  const quizTakerIds = quizEntries.map((e) => e.quizResult.userId);
  const teamOwnerIds = teamsRows.map((t) => t.ownerUserId);
  const teamInviteInviterIds = teamInviteRows
    .map((r) => r.invitation.invitedByUserId ?? r.team.ownerUserId)
    .filter(Boolean) as string[];

  const allUserIds = [...new Set([...quizTakerIds, ...teamOwnerIds, ...teamInviteInviterIds])];
  const userDisplayById = allUserIds.length > 0
    ? await getClerkUserFieldDisplaysByIds(allUserIds)
    : {};

  // ── Normalize all items ───────────────────────────────────────────────────
  const items: UnifiedInboxItem[] = [];

  // 1. Quiz results
  for (const entry of quizEntries) {
    const r = entry.quizResult;
    const key = `quiz_result:${entry.id}`;
    const isRead = readSet.has(key) || entry.read;

    const takerDisplay = userDisplayById[r.userId];
    const userName = takerDisplay?.primaryLine ?? null;
    const userEmail = takerDisplay?.primaryEmail ?? null;

    const team = r.teamId !== null ? teamMap.get(r.teamId) ?? null : null;
    const teamName = team?.name ?? null;

    let memberRole: QuizResultSummary["memberRole"] = null;
    if (team) {
      if (r.userId === team.ownerUserId) {
        memberRole = "owner";
      } else {
        const role = memberRoleMap.get(`${team.id}-${r.userId}`);
        memberRole = role === "team_admin" ? "team_admin" : role === "team_member" ? "team_member" : null;
      }
    }

    const ownerDisplay = team ? userDisplayById[team.ownerUserId] : null;

    const payload: QuizResultSummary = {
      id: r.id,
      deckName: r.deckName,
      correct: r.correct,
      incorrect: r.incorrect,
      unanswered: r.unanswered,
      total: r.total,
      percent: r.percent,
      elapsedSeconds: r.elapsedSeconds,
      savedAt: r.savedAt,
      perCard: r.perCard ?? null,
      userName,
      userEmail,
      teamName,
      memberRole,
      ownerName: ownerDisplay?.primaryLine ?? null,
      ownerEmail: ownerDisplay?.primaryEmail ?? null,
    };

    items.push({
      type: "quiz_result",
      key,
      title: `Quiz Result — ${r.deckName}`,
      description: `${r.percent}% · ${r.correct}/${r.total} correct · ${r.incorrect} incorrect · ${r.unanswered} unanswered`,
      dateIso: r.savedAt.toISOString(),
      isRead,
      requiresAction: false,
      payload,
    });
  }

  // 2. Team invitations
  for (const row of teamInviteRows) {
    const inviterId = row.invitation.invitedByUserId ?? row.team.ownerUserId;
    const inviterDisplay = userDisplayById[inviterId];
    const inviterName = inviterDisplay?.primaryLine ?? inviterDisplay?.primaryEmail ?? "Team admin";
    const expired = isTeamInviteExpired(row.invitation.expiresAt);
    const outcome = resolveTeamInviteInboxOutcome(row.invitation.status, expired);

    const key = `team_invite:${row.invitation.id}`;
    // Team invites with a completed status are auto-read (they're history)
    const autoRead =
      outcome === "accepted" ||
      outcome === "rejected" ||
      outcome === "expired" ||
      outcome === "revoked";
    const isRead = readSet.has(key) || autoRead;

    items.push({
      type: "team_invite",
      key,
      title: `Team Invitation — ${row.team.name}`,
      description: `${row.invitation.role === "team_admin" ? "Team Admin" : "Member"} role · from ${inviterName}`,
      dateIso: row.invitation.createdAt.toISOString(),
      isRead,
      requiresAction: outcome === "needs_response",
      payload: {
        invitationId: row.invitation.id,
        teamName: row.team.name,
        role: row.invitation.role,
        inviterName,
        expiresAtIso: row.invitation.expiresAt.toISOString(),
        outcome,
      },
    });
  }

  // 3. Billing invoices
  for (const invoice of billingRows) {
    const key = `billing:${invoice.id}`;
    const isRead = readSet.has(key);
    const amountText = invoice.amountCents != null
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: (invoice.currency ?? "USD").toUpperCase(),
          maximumFractionDigits: 2,
        }).format(invoice.amountCents / 100)
      : "";

    items.push({
      type: "billing",
      key,
      title: `Invoice${invoice.invoiceNumber ? ` #${invoice.invoiceNumber}` : ""}`,
      description: [amountText, invoice.status].filter(Boolean).join(" · "),
      dateIso: (invoice.paidAt ?? invoice.createdAt).toISOString(),
      isRead,
      requiresAction: false,
      payload: {
        externalId: invoice.externalId,
        invoiceNumber: invoice.invoiceNumber ?? null,
        status: invoice.status,
        amountCents: invoice.amountCents ?? null,
        currency: invoice.currency ?? null,
        hostedInvoiceUrl: invoice.hostedInvoiceUrl ?? null,
        invoicePdfUrl: invoice.invoicePdfUrl ?? null,
        paidAtIso: invoice.paidAt?.toISOString() ?? null,
      },
    });
  }

  // 4. Affiliate invites
  for (const affiliate of affiliateRows) {
    const key = `affiliate:${affiliate.id}`;
    const inviteExpired =
      affiliate.status === "pending" &&
      isAffiliateInviteExpired(affiliate.inviteExpiresAt);
    const autoRead = affiliate.status !== "pending" || inviteExpired;
    const isRead = readSet.has(key) || autoRead;

    const planEnds = new Date(affiliate.endsAt).toLocaleDateString();
    const acceptBy = new Date(affiliate.inviteExpiresAt).toLocaleDateString();
    const revokedOn = affiliate.revokedAt
      ? new Date(affiliate.revokedAt).toLocaleDateString()
      : null;

    items.push({
      type: "affiliate",
      key,
      title: `Affiliate Invitation — ${affiliate.affiliateName}`,
      description:
        affiliate.status === "pending" && !inviteExpired
          ? `Plan: ${affiliate.planAssigned} · accept by ${acceptBy} · plan ends ${planEnds}`
          : affiliate.status === "pending" && inviteExpired
            ? `Plan: ${affiliate.planAssigned} · invite link expired ${acceptBy}`
            : affiliate.status === "revoked"
              ? revokedOn
                ? `Revoked on ${revokedOn}. This marketing affiliate arrangement is no longer active.`
                : "Revoked. This marketing affiliate arrangement is no longer active."
              : affiliate.status === "active" && new Date(affiliate.endsAt) < new Date()
                ? `Plan: ${affiliate.planAssigned} · scheduled access ended ${planEnds}`
                : `Plan: ${affiliate.planAssigned} · plan access ends ${planEnds}`,
      dateIso: affiliate.createdAt.toISOString(),
      isRead,
      requiresAction:
        affiliate.status === "pending" && !inviteExpired && Boolean(affiliate.token),
      payload: {
        affiliateId: affiliate.id,
        token: affiliate.token ?? null,
        affiliateName: affiliate.affiliateName,
        planAssigned: affiliate.planAssigned,
        endsAtIso: affiliate.endsAt.toISOString(),
        inviteExpiresAtIso: affiliate.inviteExpiresAt.toISOString(),
        status: affiliate.status as "pending" | "active" | "revoked",
        inviteAcceptedAtIso: affiliate.inviteAcceptedAt?.toISOString() ?? null,
      },
    });
  }

  items.push(...buildAffiliateNoticeInboxItems(affiliateRows, readSet));

  for (const row of adminPlanLogRows) {
    if (row.action !== "plan_assigned" && row.action !== "plan_removed") continue;
    items.push(
      adminPlanAssignmentLogToInboxItem(
        {
          id: row.id,
          action: row.action,
          planName: row.planName,
          previousPlanName: row.previousPlanName,
          assignedByName: row.assignedByName,
          createdAt: row.createdAt,
          planApplicationPath: row.planApplicationPath,
        },
        readSet,
      ),
    );
  }

  const unreadCount = items.filter((i) => !i.isRead).length;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-8">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
            <Inbox className="size-7 shrink-0 sm:size-8" strokeWidth={1.75} aria-hidden />
            <span className="min-w-0">Inbox</span>
            {unreadCount > 0 && (
              <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground tabular-nums sm:size-7 sm:text-sm">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Quiz results, team invitations, billing, affiliate invites and notices, and administrator plan updates.
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

      {/* ── Unified inbox ── */}
      <InboxUnifiedClient items={items} />
    </div>
  );
}
