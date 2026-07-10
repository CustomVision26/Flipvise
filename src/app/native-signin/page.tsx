import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/clerk-auth";
import { FLIPVISE_NATIVE_QUERY_PARAM } from "@/lib/flipvise-native-constants";
import { detectNativeShellFromUserAgent } from "@/lib/native-shell-from-request";
import {
  authContinueUrl,
  safeRedirectPath,
} from "@/lib/safe-redirect-path";
import { NativeSignInClient } from "./native-signin-client";

export const dynamic = "force-dynamic";

interface NativeSignInPageProps {
  searchParams: Promise<{
    redirect?: string | string[];
    session_retry?: string | string[];
    [FLIPVISE_NATIVE_QUERY_PARAM]?: string | string[];
  }>;
}

function readSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

export default async function NativeSignInPage({
  searchParams,
}: NativeSignInPageProps) {
  const [sp, headerStore] = await Promise.all([searchParams, headers()]);
  const redirectRaw = readSearchParam(sp.redirect);
  const sessionRetry =
    sp.session_retry === "1" ||
    (Array.isArray(sp.session_retry) && sp.session_retry.includes("1"));
  const nativeQuery = readSearchParam(sp[FLIPVISE_NATIVE_QUERY_PARAM]);
  const userAgent = headerStore.get("user-agent") ?? "";
  const isNativeContext =
    detectNativeShellFromUserAgent(userAgent).isNativeShell || nativeQuery === "1";

  // Server cookies already valid — skip client Clerk bootstrap (avoids infinite spinner).
  if (!sessionRetry) {
    const { userId } = await auth();
    if (userId) {
      redirect(authContinueUrl(safeRedirectPath(redirectRaw)));
    }
  }

  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-background p-6">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        </main>
      }
    >
      <NativeSignInClient isNativeContext={isNativeContext} />
    </Suspense>
  );
}
