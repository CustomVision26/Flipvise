import { NATIVE_PUSH_TOKEN_KEY } from "@/lib/native-notifications/preferences-keys";

export type NativePushPlatform = "android" | "ios";

function resolvePlatform(): NativePushPlatform {
  const platform = document.documentElement.dataset.platform;
  if (platform === "ios") return "ios";
  return "android";
}

async function storePushToken(token: string): Promise<void> {
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.set({ key: NATIVE_PUSH_TOKEN_KEY, value: token });
}

export async function getStoredPushToken(): Promise<string | null> {
  const { Preferences } = await import("@capacitor/preferences");
  const { value } = await Preferences.get({ key: NATIVE_PUSH_TOKEN_KEY });
  return value?.trim() ? value : null;
}

async function postPushToken(token: string, appVersion?: string): Promise<void> {
  await fetch("/api/native/push-register", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Flipvise-Native-Shell": "1",
    },
    body: JSON.stringify({
      token,
      platform: resolvePlatform(),
      appVersion: appVersion ?? undefined,
    }),
  });
}

export async function revokeStoredPushToken(): Promise<void> {
  const token = await getStoredPushToken();
  const { Preferences } = await import("@capacitor/preferences");
  await Preferences.remove({ key: NATIVE_PUSH_TOKEN_KEY });

  try {
    await fetch("/api/native/push-register", {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Flipvise-Native-Shell": "1",
      },
      body: JSON.stringify(token ? { token } : {}),
    });
  } catch {
    // Non-fatal on sign-out.
  }
}

export async function registerNativePushNotifications(): Promise<void> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const { App } = await import("@capacitor/app");

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") {
    return;
  }

  await PushNotifications.addListener("registration", async (event) => {
    const token = event.value?.trim();
    if (!token) return;
    await storePushToken(token);
    let appVersion: string | undefined;
    try {
      const info = await App.getInfo();
      appVersion = info.version;
    } catch {
      // ignore
    }
    await postPushToken(token, appVersion).catch(() => {});
  });

  await PushNotifications.addListener("registrationError", () => {
    // Permission denied or Firebase misconfigured — polling still works.
  });

  await PushNotifications.register();
}
