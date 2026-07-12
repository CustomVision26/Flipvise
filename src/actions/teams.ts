"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/lib/clerk-auth";
import { createClerkClient } from "@clerk/backend";
import { randomBytes } from "node:crypto";
import { z, type input } from "zod";
import { getAccessContext } from "@/lib/access";
import { syncPlatformAdminTeamTierInvitedMetadata } from "@/lib/platform-admin-team-tier-metadata";
import { EDUCATION_TEAM_PLAN_IDS } from "@/lib/education-plans";
import {
  limitsForPlan,
  isTeamPlanId,
  TEAM_PLAN_IDS,
  type TeamPlanId,
} from "@/lib/team-plans";
import { insertTeamMemberHistoryEvent } from "@/db/queries/team-member-history";
import { teamMemberInviteCapacity } from "@/db/queries/team-plan-limits";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { buildTeamWorkspaceDashboardPath } from "@/lib/team-workspace-url";
import {
  MAX_TEAM_QUIZ_DURATION_MINUTES,
  MIN_TEAM_QUIZ_DURATION_MINUTES,
} from "@/lib/team-quiz-duration";
import {
  defaultTeamMemberStudyPrivilege,
  memberRoleQualifiesForStudyPrivileges,
} from "@/lib/team-study-privilege";
import {
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
  updateDeckAssignmentStudyPrivilege,
  updateTeamQuizDurationMinutes,
  updateOwnerQuizDefaultSettings,
  getOwnerQuizDefaultSettings,
  getTeamsByOwner,
  deleteDeckAssignment,
  attachPersonalDeckToOwnedTeamWorkspace,
  detachPersonalDeckFromOwnedTeamWorkspace,
  markInvitationAccepted,
  markInvitationRejected,
  revokePendingTeamInvitation,
  updateTeamMemberRole,
  getDecksForTeam,
  listTeamMembers,
  roleReceivesDeckAssignments,
  teamWorkspaceAllowsViewerAccess,
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
import { getClerkUserDisplayNameById } from "@/lib/clerk-user-display";
import { loopsSendTeamInvitationEmail } from "@/lib/loops";
import { notifyNativeInboxPush } from "@/lib/notify-native-inbox-push";
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
  await insertTeamMemberHistoryEvent({
    teamId: inv.teamId,
    ownerUserId: team.ownerUserId,
    action: "added",
    memberUserId: userId,
    memberRole: inv.role,
    actorUserId: inviterId,
  });
  await markInvitationAccepted(inv.id);

  try {
    await syncPlatformAdminTeamTierInvitedMetadata(clerkClient, userId);
  } catch {
    // Metadata sync is best-effort; membership is authoritative in DB.
  }
}

const WORKSPACE_CREATE_PLAN_IDS = [
  ...TEAM_PLAN_IDS,
  ...EDUCATION_TEAM_PLAN_IDS,
] as const;

const createTeamSchema = z.object({
  name: z.string().min(1).max(255),
  planSlug: z
    .string()
    .refine((v): v is (typeof WORKSPACE_CREATE_PLAN_IDS)[number] =>
      (WORKSPACE_CREATE_PLAN_IDS as readonly string[]).includes(v),
    ),
});

export async function createTeamAction(data: z.infer<typeof createTeamSchema>) {
  const { userId, activeTeamPlan, activeEducationTeamPlan, isAdmin } =
    await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = createTeamSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  if (isAdmin) {
    throw new Error(
      "Platform administrators cannot subscribe to team plans or create team workspaces. Join a subscriber’s team using an invitation.",
    );
  }

  const expectedPlan = activeTeamPlan ?? activeEducationTeamPlan;
  if (!expectedPlan || expectedPlan !== parsed.data.planSlug) {
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

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath("/dashboard/workspaces");
  revalidatePath("/onboarding/team");
  return { teamId: id, ownerUserId: userId };
}

/** Normalize workspace id from Server Action payload (string is JSON-safe for dev traces; RSC may deliver bigint). */
function parseInviteTeamId(val: unknown): number {
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "number" && Number.isFinite(val)) return Math.trunc(val);
  if (typeof val === "string") {
    const t = val.trim();
    if (/^\d+$/.test(t)) return parseInt(t, 10);
  }
  return NaN;
}

const inviteSchema = z.object({
  teamId: z
    .union([z.string(), z.number(), z.bigint()])
    .transform(parseInviteTeamId)
    .pipe(z.number().int().positive()),
  email: z.string().email(),
  role: z.enum(["team_admin", "team_member"]),
  inviteeDisplayName: z.string().max(255).optional(),
});

async function assertCanManageTeam(userId: string, teamId: number) {
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found");
  if (!(await teamWorkspaceAllowsViewerAccess(teamId, userId))) {
    throw new Error(
      team.ownerUserId === userId
        ? "Team workspaces are unavailable until you have an active team-tier plan."
        : "This workspace is unavailable because the subscriber no longer has an active team-tier plan.",
    );
  }
  if (team.ownerUserId === userId) {
    return team;
  }
  const m = await getMemberRecord(teamId, userId);
  if (m?.role === "team_admin") {
    return team;
  }
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
  revalidatePath("/dashboard/team-admin", "layout");
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
  revalidatePath("/dashboard/team-admin", "layout");
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

/** Look up a Clerk user ID by email address (best-effort, returns null if not found). */
async function findClerkUserIdByEmail(normalizedEmail: string): Promise<string | null> {
  try {
    const result = await clerkClient.users.getUserList({
      emailAddress: [normalizedEmail],
      limit: 1,
    });
    return result.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function inviteTeamMemberAction(data: input<typeof inviteSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = inviteSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  const capacity = await teamMemberInviteCapacity(team.planSlug, team.id);
  if (capacity.atCapacity) {
    throw new Error(
      `Member limit reached for this team (${capacity.maxMembersPerTeam} on your plan).`,
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

  const trimmedInviteName = parsed.data.inviteeDisplayName?.trim();
  await insertTeamInvitation(
    team.id,
    normalizedEmail,
    parsed.data.role,
    token,
    expiresAt,
    userId,
    trimmedInviteName && trimmedInviteName.length > 0 ? trimmedInviteName : null,
  );

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const inviteUrl = `${base}/invite/team/${token}`;
  const dashboardInboxUrl = `${base}/dashboard/inbox`;

  const inviterName = await getClerkUserDisplayNameById(userId);
  const roleLabel = parsed.data.role === "team_admin" ? "Team admin" : "Member";
  const inviteeLabel =
    trimmedInviteName && trimmedInviteName.length > 0 ? trimmedInviteName : "";

  /** Registered Clerk user → dashboard inbox (+ push); no Loops transactional email. */
  const registeredClerkInvitee = await findClerkUserIdByEmail(normalizedEmail);

  if (!registeredClerkInvitee) {
    await loopsSendTeamInvitationEmail({
      inviteeEmail: normalizedEmail,
      inviteeDisplayName: inviteeLabel,
      workspaceName: team.name,
      roleLabel,
      inviterName,
      acceptInvitationUrl: inviteUrl,
      dashboardInboxUrl,
      expiresInDays: TEAM_INVITE_EXPIRY_DAYS,
      subjectLine: `You're invited to ${team.name}`,
    });
  } else {
    notifyNativeInboxPush({
      recipientUserId: registeredClerkInvitee,
      category: "team_invite",
      body: `You're invited to ${team.name}`,
    });
  }

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/inbox");
  return { inviteUrl };
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
  revalidatePath("/dashboard/team-admin", "layout");

  const team = await getTeamById(inv.teamId);
  const member = await getMemberRecord(inv.teamId, userId);
  const qs = new URLSearchParams();
  qs.set("team_invite", "accepted");
  if (team && member && isTeamPlanId(team.planSlug)) {
    const workspacePath = buildTeamWorkspaceDashboardPath({
      teamId: team.id,
      ownerUserId: team.ownerUserId,
      planSlug: team.planSlug,
      teamMemberUrlParam: member.id,
    });
    const workspaceQs = new URLSearchParams(workspacePath.split("?")[1] ?? "");
    workspaceQs.set("team_invite", "accepted");
    return { teamId: inv.teamId, redirectUrl: `/dashboard?${workspaceQs.toString()}` };
  }

  return { teamId: inv.teamId, redirectUrl: `/dashboard?${qs.toString()}` };
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
  revalidatePath("/dashboard/team-admin", "layout");
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
  revalidatePath("/dashboard/team-admin", "layout");
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
  revalidatePath("/dashboard/team-admin", "layout");
}

const studyPrivilegeSchema = z.enum(["standard_review", "quiz", "both"]);

const assignDeckSchema = z.object({
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  memberUserId: z.string().min(1),
  studyPrivilege: studyPrivilegeSchema.default("both"),
});

export async function assignDeckToMemberAction(data: z.infer<typeof assignDeckSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = assignDeckSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);

  const member = await getMemberRecord(parsed.data.teamId, parsed.data.memberUserId);
  if (!member || !roleReceivesDeckAssignments(member.role)) {
    throw new Error("Assignments apply only to team members and team admins.");
  }

  const team = await getTeamById(parsed.data.teamId);
  if (!team) throw new Error("Team not found");
  const teamDecks = await getDecksForTeam(team.id, team.ownerUserId);
  if (!teamDecks.some((d) => d.id === parsed.data.deckId)) {
    throw new Error("Deck does not belong to this team.");
  }

  const studyPrivilege = memberRoleQualifiesForStudyPrivileges(member.role, team.planSlug)
    ? parsed.data.studyPrivilege
    : defaultTeamMemberStudyPrivilege();

  await insertDeckAssignment(
    parsed.data.teamId,
    parsed.data.deckId,
    parsed.data.memberUserId,
    userId,
    studyPrivilege,
  );

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath(`/decks/${parsed.data.deckId}/study`);
}

const updateDeckStudyPrivilegeSchema = z.object({
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  memberUserId: z.string().min(1),
  studyPrivilege: studyPrivilegeSchema,
});

export async function updateDeckAssignmentStudyPrivilegeAction(
  data: z.infer<typeof updateDeckStudyPrivilegeSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateDeckStudyPrivilegeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);

  const team = await getTeamById(parsed.data.teamId);
  if (!team) throw new Error("Team not found");

  const member = await getMemberRecord(parsed.data.teamId, parsed.data.memberUserId);
  if (!member || !memberRoleQualifiesForStudyPrivileges(member.role, team.planSlug)) {
    throw new Error(
      "Study privileges apply only to team members, or to team admins on Education Gold / Enterprise.",
    );
  }

  await updateDeckAssignmentStudyPrivilege(
    parsed.data.teamId,
    parsed.data.deckId,
    parsed.data.memberUserId,
    parsed.data.studyPrivilege,
  );

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath(`/decks/${parsed.data.deckId}/study`);
}

const quizDurationMinutesSchema = z
  .number()
  .int()
  .min(MIN_TEAM_QUIZ_DURATION_MINUTES)
  .max(MAX_TEAM_QUIZ_DURATION_MINUTES);

const updateTeamQuizDurationSchema = z.object({
  teamId: z.number().int().positive(),
  /** Null clears the workspace override so the subscriber default applies. */
  durationMinutes: z.union([quizDurationMinutesSchema, z.null()]),
});

export async function updateTeamQuizDurationAction(
  data: z.infer<typeof updateTeamQuizDurationSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateTeamQuizDurationSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await assertCanManageTeam(userId, parsed.data.teamId);
  const ownerSettings = await getOwnerQuizDefaultSettings(team.ownerUserId);
  if (ownerSettings.enforceDefaultForAllWorkspaces) {
    throw new Error(
      "The subscriber has locked one quiz time for all workspaces. Per-workspace times cannot be changed.",
    );
  }

  await updateTeamQuizDurationMinutes(parsed.data.teamId, parsed.data.durationMinutes);

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath("/dashboard/team-admin/quiz-results", "layout");
}

const updateOwnerQuizDefaultSchema = z.object({
  durationMinutes: quizDurationMinutesSchema,
  enforceDefaultForAllWorkspaces: z.boolean(),
});

export async function updateOwnerQuizDefaultAction(
  data: z.infer<typeof updateOwnerQuizDefaultSchema>,
) {
  try {
    const { userId } = await getAccessContext();
    if (!userId) throw new Error("Unauthorized");

    const parsed = updateOwnerQuizDefaultSchema.safeParse(data);
    if (!parsed.success) throw new Error("Invalid input");

    const ownedTeams = await getTeamsByOwner(userId);
    if (ownedTeams.length === 0) {
      throw new Error("Only the workspace subscriber can set a default for all workspaces.");
    }

    await updateOwnerQuizDefaultSettings(userId, {
      defaultQuizDurationMinutes: parsed.data.durationMinutes,
      enforceDefaultForAllWorkspaces: parsed.data.enforceDefaultForAllWorkspaces,
    });

    revalidatePath("/dashboard/team-admin", "layout");
    revalidatePath("/dashboard/team-admin/quiz-results", "layout");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save default quiz timer.";
    throw new Error(msg);
  }
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

  await assertTeamOwner(userId, parsed.data.teamId);

  await deleteDeckAssignment(
    parsed.data.teamId,
    parsed.data.deckId,
    parsed.data.memberUserId,
  );

  revalidatePath("/dashboard/team-admin", "layout");
}

const linkPersonalDeckToWorkspaceSchema = z.object({
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
});

export async function linkPersonalDeckToTeamWorkspaceAction(
  data: z.infer<typeof linkPersonalDeckToWorkspaceSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = linkPersonalDeckToWorkspaceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await getTeamById(parsed.data.teamId);
  if (!team || team.ownerUserId !== userId) {
    throw new Error("Only the workspace subscriber can link personal decks.");
  }

  await assertCanManageTeam(userId, parsed.data.teamId);

  if (isTeamPlanId(team.planSlug)) {
    const limits = limitsForPlan(team.planSlug);
    const inWorkspace = await getDecksForTeam(team.id, team.ownerUserId);
    const alreadyCounted = inWorkspace.some((d) => d.id === parsed.data.deckId);
    if (!alreadyCounted && inWorkspace.length >= limits.maxDecksPerWorkspace) {
      throw new Error(
        `Workspace deck limit reached — up to ${limits.maxDecksPerWorkspace} decks in this workspace on your plan.`,
      );
    }
  }

  await attachPersonalDeckToOwnedTeamWorkspace({
    teamId: parsed.data.teamId,
    deckId: parsed.data.deckId,
    subscriberUserId: userId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard/team-admin", "layout");
}

export async function unlinkPersonalDeckFromTeamWorkspaceAction(
  data: z.infer<typeof linkPersonalDeckToWorkspaceSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = linkPersonalDeckToWorkspaceSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const team = await getTeamById(parsed.data.teamId);
  if (!team || team.ownerUserId !== userId) {
    throw new Error("Only the workspace subscriber can unlink personal decks.");
  }

  await assertCanManageTeam(userId, parsed.data.teamId);

  await detachPersonalDeckFromOwnedTeamWorkspace({
    teamId: parsed.data.teamId,
    deckId: parsed.data.deckId,
    subscriberUserId: userId,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/decks/${parsed.data.deckId}`);
  revalidatePath("/dashboard/team-admin", "layout");
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

  revalidatePath("/dashboard/team-admin", "layout");
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

  const member = await getMemberRecord(parsed.data.teamId, parsed.data.memberUserId);
  if (!member) throw new Error("Member not found.");

  await deleteTeamMember(parsed.data.teamId, parsed.data.memberUserId);

  await insertTeamMemberHistoryEvent({
    teamId: parsed.data.teamId,
    ownerUserId: team.ownerUserId,
    action: "removed",
    memberUserId: parsed.data.memberUserId,
    memberRole: member.role,
    actorUserId: userId,
  });

  try {
    await syncPlatformAdminTeamTierInvitedMetadata(clerkClient, parsed.data.memberUserId);
  } catch {
    // best-effort
  }

  revalidatePath("/dashboard/team-admin", "layout");
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

  revalidatePath("/dashboard/team-admin", "layout");
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
