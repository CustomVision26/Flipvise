import type { NativeShellPlatform } from "@/lib/native-shell-from-request";

/** Android bundled shell (`server.androidScheme: https`). */
export const FLIPVISE_OFFLINE_SHELL_ANDROID_URL = "https://localhost/";

/** iOS bundled shell (`server.iosScheme` default: `capacitor`). */
export const FLIPVISE_OFFLINE_SHELL_IOS_URL =
  "capacitor://localhost/index.html";

/** Server-safe offline shell URL from WebView platform detection. */
export function resolveOfflineShellUrlFromPlatform(
  platform?: NativeShellPlatform,
): string {
  if (platform === "ios") return FLIPVISE_OFFLINE_SHELL_IOS_URL;
  return FLIPVISE_OFFLINE_SHELL_ANDROID_URL;
}
