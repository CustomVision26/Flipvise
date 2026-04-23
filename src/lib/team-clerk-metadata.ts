import type { ClerkClient } from "@clerk/backend";
import { isTeamPlanId } from "@/lib/team-plans";

function isActiveSubscriptionItemStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "active" || s === "trialing";
}

/**
 * When the user has an active Clerk Billing subscription item for a team plan,
 * sets `publicMetadata.teamRole` to `"team_admin"` (subscriber / org owner for teams).
 * Clears `teamRole` and `teamPlanId` when they no longer have an active team plan.
 */
export async function syncTeamSubscriberRoleMetadata(
  clerkClient: ClerkClient,
  userId: string,
): Promise<void> {
  let subscription: Awaited<
    ReturnType<ClerkClient["billing"]["getUserBillingSubscription"]>
  >;
  try {
    subscription = await clerkClient.billing.getUserBillingSubscription(userId);
  } catch {
    return;
  }

  const items = subscription.subscriptionItems ?? [];
  let activeTeamPlanId: string | null = null;
  for (const item of items) {
    if (!isActiveSubscriptionItemStatus(String(item.status))) continue;
    const pid = item.planId;
    if (pid && isTeamPlanId(pid)) {
      activeTeamPlanId = pid;
      break;
    }
  }

  const user = await clerkClient.users.getUser(userId);
  const prev = { ...(user.publicMetadata as Record<string, unknown>) };

  if (activeTeamPlanId) {
    prev.teamRole = "team_admin";
    prev.teamPlanId = activeTeamPlanId;
  } else {
    if (prev.teamRole === "team_admin") {
      delete prev.teamRole;
    }
    if ("teamPlanId" in prev) {
      delete prev.teamPlanId;
    }
  }

  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: prev,
  });
}

/** Best-effort user id from Clerk Billing webhook payloads (shape may vary). */
export function extractBillingUserIdFromWebhookData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const tryStr = (v: unknown): string | null =>
    typeof v === "string" && v.startsWith("user_") ? v : null;

  const direct = [
    tryStr(o.user_id),
    tryStr(o.userId),
    tryStr(o.payer_id),
    tryStr(o.payerId),
  ].find(Boolean);
  if (direct) return direct;

  const payer = o.payer;
  if (payer && typeof payer === "object") {
    const id = tryStr((payer as Record<string, unknown>).id);
    if (id) return id;
  }

  const sub = o.subscription;
  if (sub && typeof sub === "object") {
    const s = sub as Record<string, unknown>;
    const fromSub = [tryStr(s.payer_id), tryStr(s.payerId)].find(Boolean);
    if (fromSub) return fromSub;
  }

  return null;
}
