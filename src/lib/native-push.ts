import "server-only";

import {
  deleteNativePushTokensByIds,
  listActiveNativePushTokensForUser,
} from "@/db/queries/native-push-tokens";

let messagingClient: import("firebase-admin/messaging").Messaging | null = null;
let initAttempted = false;

async function getMessaging(): Promise<
  import("firebase-admin/messaging").Messaging | null
> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!json) return null;

  if (!initAttempted) {
    initAttempted = true;
    try {
      const { cert, getApps, initializeApp } = await import("firebase-admin/app");
      const { getMessaging } = await import("firebase-admin/messaging");
      if (getApps().length === 0) {
        const serviceAccount = JSON.parse(json) as Parameters<typeof cert>[0];
        initializeApp({
          credential: cert(serviceAccount),
        });
      }
      messagingClient = getMessaging();
    } catch {
      messagingClient = null;
    }
  }

  return messagingClient;
}

export type NativePushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

/** Sends a push notification to all registered native devices for a user. No-op when Firebase is not configured. */
export async function sendNativePushToUser(
  userId: string,
  payload: NativePushPayload,
): Promise<void> {
  const messaging = await getMessaging();
  if (!messaging) return;

  const tokenRows = await listActiveNativePushTokensForUser(userId);
  if (tokenRows.length === 0) return;

  const data: Record<string, string> = {
    route: payload.data?.route ?? "/dashboard/inbox",
    ...payload.data,
  };

  const response = await messaging.sendEachForMulticast({
    tokens: tokenRows.map((row) => row.token),
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data,
    android: {
      priority: "high",
      notification: {
        channelId: "flipvise_default",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
  });

  const staleIds: number[] = [];
  response.responses.forEach((result, index) => {
    if (result.success) return;
    const code = result.error?.code;
    if (
      code === "messaging/invalid-registration-token" ||
      code === "messaging/registration-token-not-registered"
    ) {
      const row = tokenRows[index];
      if (row) staleIds.push(row.id);
    }
  });

  if (staleIds.length > 0) {
    await deleteNativePushTokensByIds(staleIds).catch(() => {});
  }
}
