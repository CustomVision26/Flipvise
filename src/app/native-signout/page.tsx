import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { detectNativeShellFromUserAgent } from "@/lib/native-shell-from-request";
import { NativeSignOutHandoff } from "./native-signout-handoff";

export const dynamic = "force-dynamic";

/**
 * Clerk `afterSignOutUrl` for the Capacitor WebView.
 * Avoids flashing the marketing homepage (`/`) before the offline Study shell.
 */
export default async function NativeSignOutPage() {
  const ua = (await headers()).get("user-agent") ?? "";
  const isNative = detectNativeShellFromUserAgent(ua).isNativeShell;
  if (!isNative) {
    redirect("/");
  }

  return <NativeSignOutHandoff />;
}
