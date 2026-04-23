"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { syncPlatformAdminTeamTierInvitedMetadata } from "@/lib/platform-admin-team-tier-metadata";
import {
  limitsForPlan,
  personalDashboardPlanQueryValue,
  type TeamPlanId,
} from "@/lib/team-plans";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import {
  countMembersForTeam,
  countPendingInvitationsForTeam,
  countTeamsForOwner,
  deleteInvitation,
  deleteTeamMember,
  getActivePendingInvitationForTeamEmail,
  getInvitationByToken,
  getMemberRecord,
  getTeamById,
  getTeamInvitationRowForInviteeEmail,
  insertTeam,
  insertTeamInvitation,
  insertTeamMember,
  insertDeckAssignment,
  deleteDeckAssignment,
  transferTeamDeckBetweenWorkspaces,
  markInvitationAccepted,
  markInvitationRejected,
  revokePendingTeamInvitation,
  updateTeamMemberRole,
  getDecksForTeam,
  listTeamMembers,
} from "@/db/queries/teams";
import {
  deleteTeamByOwner,
  insertTeamWorkspaceEvent,
  updateOwnedTeamName,
} from "@/db/queries/team-workspace-events";
import {
  isTeamInviteExpired,
  TEAM_INVITE_EXPIRY_DAYS,
} from "@/lib/team-invite-expiry";
import type { InferSelectModel } from "drizzle-orm";
import { teamInvitations } from "@/db/schema";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

type TeamInvitationRow = InferSelectModel<typeof teamInvitations>;

async function completeAcceptTeamInvitation(
  userId: string,
  inv: TeamInvitationRow,
) {
  const user = await clerkClient.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email || email !== inv.email.toLowerCase()) {
    throw new Error("Sign in with the invited email address to accept.");
  }

  const existing = await getMemberRecord(inv.teamId, userId);
  if (existing) throw new Error("You are already a member of this team.");

  const team = await getTeamById(inv.teamId);
  if (!team) throw new Error("Team not found.");

  const inviterId = inv.invitedByUserId ?? team.ownerUserId;
  const addedByAsOwner =
    inv.invitedByUserId == null || inv.invitedByUserId === team.ownerUserId;

  await insertTeamMember(inv.teamId, userId, inv.role, {
    addedByUserId: inviterId,
    addedByAsOwner,
  });
  await markInvitationAccepted(inv.id);

  try {
    await syncPlatformAdminTeamTierInvitedMetadata(clerkClient, userId);
  } catch {
    // Metadata sync is best-effort; membership is authoritative in DB.
  }
}

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  planSlug: z.enum([
    "pro_team_basic",
    "pro_team_gold",
    "pro_platinum_plan",
    "pro_enterprise",
  ]),
});

export async function createTeamAction(data: z.infer<typeof createTeamSchema>) {
  const { userId, activeTeamPlan, isAdmin } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createTeamSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  if (isAdmin) {
    throw new Error(
      "Platform administrators cannot subscribe to team plans or create team workspaces. Join a subscriber’s team using an invitation.",
    );
  }

  if (activeTeamPlan !== parsed.data.planSlug) {
    throw new Error("Plan mismatch — refresh and try again.");
  }

  const limits = limitsForPlan(parsed.data.planSlug);
  const existing = await countTeamsForOwner(userId);
  if (existing >= limits.maxTeams) {
    throw new Error(`Your plan allows up to ${limits.maxTeams} team(s).`);
  }

  const id = await insertTeam(userId, parsed.data.name, parsed.data.planSlug);
  if (!id) throw new Error("Could not create team.");

  await insertTeamWorkspaceEvent({
    ownerUserId: userId,
    action: "created",
    teamId: id,
    teamName: parsed.data.name,
    planSlug: parsed.data.planSlug,
    previousTeamName: null,
  });

  revalidatePath("/dashboard/team-admin");
  revalidatePath("/dashboard/workspaces");
  revalidatePath("/onboarding/team");
  return { teamId: id, ownerUserId: userId };
}

const inviteSchema = z.object({
  teamId: z.number().int().positive(),
  email: z.string().email(),
  role: z.enum(["team_admin", "team_member"]),
});

async function assertCanManageTeam(userId: string, teamId: number) {
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found");
  if (team.ownerUserId === userId) return team;
  const m = await getMemberRecord(teamId, userId);
  if (m?.role === "team_admin") return team;
  throw new Error("Forbidden");
}

async function assertTeamOwner(userId: string, teamId: number) {
  const team = await getTeamById(teamId);
  if (!team || team.ownerUserId !== userId) throw new Error("Forbidden");
  return team;
}

const updateTeamWorkspaceNameSchema = z.object({
  teamId: z.number().int().positive(),
  name: z.string().min(1).max(255),
});

export async function updateTeamWorkspaceNameAction(
  data: z.infer<typeof updateTeamWorkspaceNameSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateTeamWorkspaceNameSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertTeamOwner(userId, parsed.data.teamId);
  const nextName = parsed.data.name.trim();
  if (team.name === nextName) {
    revalidatePath("/dashboard/workspaces");
    return;
  }

  const updated = await updateOwnedTeamName(userId, parsed.data.teamId, nextName);
  if (!updated) throw new Error("Could not update workspace.");

  await insertTeamWorkspaceEvent({
    ownerUserId: userId,
    action: "updated",
    teamId: parsed.data.teamId,
    teamName: nextName,
    planSlug: team.planSlug,
    previousTeamName: team.name,
  });

  revalidatePath("/dashboard/workspaces");
  revalidatePath("/dashboard/team-admin");
  revalidatePath("/dashboard");
}

const deleteTeamWorkspaceSchema = z.object({
  teamId: z.number().int().positive(),
});

export async function deleteTeamWorkspaceAction(
  data: z.infer<typeof deleteTeamWorkspaceSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = deleteTeamWorkspaceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertTeamOwner(userId, parsed.data.teamId);

  const result = await deleteTeamByOwner(userId, parsed.data.teamId);
  if (!result) throw new Error("Workspace not found.");

  const store = await cookies();
  const ctx = store.get(TEAM_CONTEXT_COOKIE)?.value;
  if (ctx === String(parsed.data.teamId)) {
    store.delete(TEAM_CONTEXT_COOKIE);
  }

  revalidatePath("/dashboard/workspaces");
  revalidatePath("/dashboard/team-admin");
  revalidatePath("/dashboard");
}

async function clerkUserHasNormalizedEmail(
  clerkUserId: string,
  normalizedEmail: string,
): Promise<boolean> {
  try {
    const u = await clerkClient.users.getUser(clerkUserId);
    if (u.primaryEmailAddress?.emailAddress?.toLowerCase() === normalizedEmail) return true;
    return (u.emailAddresses ?? []).some(
      (e) => e.emailAddress?.toLowerCase() === normalizedEmail,
    );
  } catch {
    return false;
  }
}

export async function inviteTeamMemberAction(data: z.infer<typeof inviteSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = inviteSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  const limits = limitsForPlan(team.planSlug as TeamPlanId);

  const members = await countMembersForTeam(team.id);
  const pending = await countPendingInvitationsForTeam(team.id);
  if (members + pending >= limits.maxMembersPerTeam) {
    throw new Error(
      `Member limit reached for this team (${limits.maxMembersPerTeam} on your plan).`,
    );
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  const duplicatePending = await getActivePendingInvitationForTeamEmail(
    team.id,
    normalizedEmail,
  );
  if (duplicatePending) {
    throw new Error(
      "An invitation is already pending for this email on this workspace. Wait for it to be accepted or expire, or ask the invitee to respond from their inbox.",
    );
  }

  if (await clerkUserHasNormalizedEmail(team.ownerUserId, normalizedEmail)) {
    throw new Error("You cannot invite the team owner by email.");
  }

  const memberRows = await listTeamMembers(team.id);
  for (const row of memberRows) {
    if (await clerkUserHasNormalizedEmail(row.userId, normalizedEmail)) {
      throw new Error(
        "This email already belongs to a member of this team. Go to Member Tab to remove user or change their role.",
      );
    }
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * TEAM_INVITE_EXPIRY_DAYS,
  );

  await insertTeamInvitation(
    team.id,
    normalizedEmail,
    parsed.data.role,
    token,
    expiresAt,
    userId,
  );

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  revalidatePath("/dashboard/team-admin");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  return { inviteUrl: `${base}/invite/team/${token}` };
}

const acceptSchema = z.object({
  token: z.string().min(16),
});

export async function acceptTeamInvitationAction(data: z.infer<typeof acceptSchema>) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = acceptSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const inv = await getInvitationByToken(parsed.data.token);
  if (!inv || inv.status !== "pending") throw new Error("Invitation not found.");
  if (isTeamInviteExpired(inv.expiresAt)) throw new Error("Invitation expired.");

  await completeAcceptTeamInvitation(userId, inv);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/team-admin");

  const ctx = await getAccessContext();
  const plan = personalDashboardPlanQueryValue(ctx.activeTeamPlan, ctx.isPro);
  const qs = new URLSearchParams({
    userid: userId,
    plan,
    team_invite: "accepted",
  });
  const redirectUrl = `/dashboard?${qs.toString()}`;

  return { teamId: inv.teamId, redirectUrl };
}

const invitationByIdSchema = z.object({
  invitationId: z.number().int().positive(),
});

export async function acceptTeamInvitationByIdAction(
  data: z.infer<typeof invitationByIdSchema>,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = invitationByIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const user = await clerkClient.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) throw new Error("No email on account.");

  const inv = await getTeamInvitationRowForInviteeEmail(
    parsed.data.invitationId,
    email,
  );
  if (!inv || inv.status !== "pending") {
    throw new Error("Invitation not found or no longer pending.");
  }
  if (isTeamInviteExpired(inv.expiresAt)) {
    throw new Error("This invitation has expired.");
  }

  await completeAcceptTeamInvitation(userId, inv);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/team-admin");
  return { teamId: inv.teamId };
}

export async function rejectTeamInvitationByIdAction(
  data: z.infer<typeof invitationByIdSchema>,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const parsed = invitationByIdSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const user = await clerkClient.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) throw new Error("No email on account.");

  const inv = await getTeamInvitationRowForInviteeEmail(
    parsed.data.invitationId,
    email,
  );
  if (!inv || inv.status !== "pending") {
    throw new Error("Invitation not found or no longer pending.");
  }

  await markInvitationRejected(inv.id);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/team-admin");
}

const revokeTeamInvitationSchema = z.object({
  teamId: z.number().int().positive(),
  invitationId: z.number().int().positive(),
});

export async function revokeTeamInvitationAction(
  data: z.infer<typeof revokeTeamInvitationSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = revokeTeamInvitationSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);

  let row: { id: number } | null;
  try {
    row = await revokePendingTeamInvitation(
      parsed.data.invitationId,
      parsed.data.teamId,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      /invalid input value for enum/i.test(msg) ||
      (/Failed query:.*update.*team_invitations/i.test(msg) && /revoked/i.test(msg))
    ) {
      throw new Error(
        "Database is missing the invitation status “revoked”. Run: npm run db:ensure-team-invite-revoked-enum (or apply migration 0008_team_invitation_revoked.sql), then try again.",
      );
    }
    throw e;
  }
  if (!row) {
    throw new Error("Invitation not found, already handled, or no longer active.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/team-admin");
}

const assignDeckSchema = z.object({
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  memberUserId: z.string().min(1),
});

export async function assignDeckToMemberAction(data: z.infer<typeof assignDeckSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = assignDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);

  const member = await getMemberRecord(parsed.data.teamId, parsed.data.memberUserId);
  if (!member || member.role !== "team_member") {
    throw new Error("Assignments apply only to normal team members.");
  }

  const team = await getTeamById(parsed.data.teamId);
  if (!team) throw new Error("Team not found");
  const teamDecks = await getDecksForTeam(team.id, team.ownerUserId);
  if (!teamDecks.some((d) => d.id === parsed.data.deckId)) {
    throw new Error("Deck does not belong to this team.");
  }

  await insertDeckAssignment(
    parsed.data.teamId,
    parsed.data.deckId,
    parsed.data.memberUserId,
  );

  revalidatePath("/dashboard/team-admin");
}

const unassignDeckSchema = z.object({
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  memberUserId: z.string().min(1),
});

export async function unassignDeckFromMemberAction(data: z.infer<typeof unassignDeckSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = unassignDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);

  await deleteDeckAssignment(
    parsed.data.teamId,
    parsed.data.deckId,
    parsed.data.memberUserId,
  );

  revalidatePath("/dashboard/team-admin");
}

const transferTeamDeckWorkspaceSchema = z
  .object({
    deckId: z.number().int().positive(),
    fromTeamId: z.number().int().positive(),
    toTeamId: z.number().int().positive(),
  })
  .refine((d) => d.fromTeamId !== d.toTeamId, {
    message: "Choose a different destination workspace.",
  });

export async function transferTeamDeckWorkspaceAction(
  data: z.infer<typeof transferTeamDeckWorkspaceSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = transferTeamDeckWorkspaceSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    throw new Error(msg);
  }

  await assertCanManageTeam(userId, parsed.data.fromTeamId);
  await assertCanManageTeam(userId, parsed.data.toTeamId);

  await transferTeamDeckBetweenWorkspaces({
    deckId: parsed.data.deckId,
    fromTeamId: parsed.data.fromTeamId,
    toTeamId: parsed.data.toTeamId,
  });

  revalidatePath("/dashboard/team-admin");
}

const roleSchema = z.object({
  teamId: z.number().int().positive(),
  memberUserId: z.string().min(1),
  role: z.enum(["team_admin", "team_member"]),
});

export async function updateTeamMemberRoleAction(data: z.infer<typeof roleSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = roleSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  if (parsed.data.memberUserId === team.ownerUserId) throw new Error("Cannot change owner role.");

  await updateTeamMemberRole(parsed.data.teamId, parsed.data.memberUserId, parsed.data.role);

  try {
    await syncPlatformAdminTeamTierInvitedMetadata(clerkClient, parsed.data.memberUserId);
  } catch {
    // best-effort
  }

  revalidatePath("/dashboard/team-admin");
}

const removeMemberSchema = z.object({
  teamId: z.number().int().positive(),
  memberUserId: z.string().min(1),
});

export async function removeTeamMemberAction(data: z.infer<typeof removeMemberSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = removeMemberSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  if (parsed.data.memberUserId === team.ownerUserId) throw new Error("Cannot remove the owner.");

  await deleteTeamMember(parsed.data.teamId, parsed.data.memberUserId);

  try {
    await syncPlatformAdminTeamTierInvitedMetadata(clerkClient, parsed.data.memberUserId);
  } catch {
    // best-effort
  }

  revalidatePath("/dashboard/team-admin");
}

const cancelInviteSchema = z.object({
  teamId: z.number().int().positive(),
  invitationId: z.number().int().positive(),
});

export async function cancelTeamInvitationAction(data: z.infer<typeof cancelInviteSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = cancelInviteSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);
  await deleteInvitation(parsed.data.invitationId, parsed.data.teamId);

  revalidatePath("/dashboard/team-admin");
}

export async function setTeamContextCookieAction(teamId: number | null) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const store = await cookies();
  if (teamId === null) {
    store.delete(TEAM_CONTEXT_COOKIE);
  } else {
    const m = await getMemberRecord(teamId, userId);
    const team = await getTeamById(teamId);
    const isOwner = team?.ownerUserId === userId;
    if (!isOwner && !m) throw new Error("Forbidden");
    store.set(TEAM_CONTEXT_COOKIE, String(teamId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }

  revalidatePath("/dashboard");
}
