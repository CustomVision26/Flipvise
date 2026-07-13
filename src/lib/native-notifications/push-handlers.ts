import { toast } from "sonner";
import {
  NATIVE_LAST_PUSH_AT_KEY,
} from "@/lib/native-notifications/preferences-keys";

async function markRecentPushReceived(): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({
    key: NATIVE_LAST_PUSH_AT_KEY,
    value: String(Date.now()),
  });
}

export async function wasPushRecentlyReceived(withinMs = 10_000): Promise<boolean> {
  const { Preferences } = await import("@capacitor/preferences");
  const { value } = await Preferences.get({ key: NATIVE_LAST_PUSH_AT_KEY });
  const at = Number(value);
  if (!Number.isFinite(at) || at <= 0) return false;
  return Date.now() - at < withinMs;
}

function navigateToRoute(route: string): void {
  const target = route.startsWith("/") ? route : "/dashboard/inbox";
  if (window.location.pathname === target) return;
  window.location.assign(target);
}

export async function attachNativePushHandlers(): Promise<() => void> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return () => {};
  if (!Capacitor.isPluginAvailable("PushNotifications")) return () => {};

  const { PushNotifications } = await import("@capacitor/push-notifications");

  const receivedHandle = await PushNotifications.addListener(
    "pushNotificationReceived",
    (notification) => {
      void markRecentPushReceived();
      const title = notification.title ?? "New inbox message";
      const body =
        notification.body ?? "Open your inbox to read the message.";
      toast.info(title, {
        description: body,
        action: {
          label: "Open inbox",
          onClick: () => navigateToRoute("/dashboard/inbox"),
        },
      });
    },
  );

  const actionHandle = await PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      const route =
        action.notification.data?.route ??
        action.notification.data?.url ??
        "/dashboard/inbox";
      navigateToRoute(typeof route === "string" ? route : "/dashboard/inbox");
    },
  );

  return () => {
    void receivedHandle.remove();
    void actionHandle.remove();
  };
}
