import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { auth } from "@/lib/clerk-auth";
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
  }>;
}

export default async function NativeSignInPage({
  searchParams,
}: NativeSignInPageProps) {
  const sp = await searchParams;
  const redirectRaw =
    typeof sp.redirect === "string"
      ? sp.redirect
      : Array.isArray(sp.redirect)
        ? sp.redirect[0]
        : undefined;
  const sessionRetry =
    sp.session_retry === "1" ||
    (Array.isArray(sp.session_retry) && sp.session_retry.includes("1"));

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
      <NativeSignInClient />
    </Suspense>
  );
}
