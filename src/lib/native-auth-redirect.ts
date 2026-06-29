import { headers } from "next/headers";
import { FLIPVISE_NATIVE_QUERY_PARAM } from "@/lib/flipvise-native-constants";
import { detectNativeShellFromUserAgent } from "@/lib/native-shell-from-request";
import { safeRedirectPath } from "@/lib/safe-redirect-path";

/** Build `/native-signin` URL for the Capacitor WebView (never `/` or modal sign-in). */
export function nativeSignInPath(
  redirectPath: string,
  extraParams?: Record<string, string>,
): string {
  const params = new URLSearchParams({
    [FLIPVISE_NATIVE_QUERY_PARAM]: "1",
    redirect: safeRedirectPath(redirectPath),
    ...extraParams,
  });
  return `/native-signin?${params.toString()}`;
}

export async function isNativeShellRequest(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  return detectNativeShellFromUserAgent(ua).isNativeShell;
}
