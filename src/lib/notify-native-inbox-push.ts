import { sendNativePushToUser } from "@/lib/native-push";

export type NativeInboxPushCategory =
  | "team_invite"
  | "affiliate_broadcast"
  | "subscription_checkout"
  | "billing_notice"
  | "support"
  | "contact_us"
  | "admin_plan_invite"
  | "quiz_result"
  | "welcome";

const CATEGORY_TITLES: Record<NativeInboxPushCategory, string> = {
  team_invite: "Team invitation",
  affiliate_broadcast: "New inbox message",
  subscription_checkout: "Subscription confirmed",
  billing_notice: "Billing notice",
  support: "Support update",
  contact_us: "Contact Us update",
  admin_plan_invite: "Plan assignment request",
  quiz_result: "Quiz result",
  welcome: "Welcome to Flipvise",
};

/** Fire-and-forget native push for a single inbox recipient. */
export function notifyNativeInboxPush(input: {
  recipientUserId: string;
  category: NativeInboxPushCategory;
  body?: string;
}): void {
  void sendNativePushToUser(input.recipientUserId, {
    title: CATEGORY_TITLES[input.category],
    body: input.body?.trim() || "Open your inbox to read the message.",
    data: {
      route: "/dashboard/inbox",
      category: input.category,
    },
  }).catch(() => {});
}

/** Fire-and-forget native push for multiple inbox recipients (deduped). */
export function notifyNativeInboxPushMany(
  recipientUserIds: string[],
  category: NativeInboxPushCategory,
  body?: string,
): void {
  for (const recipientUserId of new Set(recipientUserIds)) {
    notifyNativeInboxPush({ recipientUserId, category, body });
  }
}
