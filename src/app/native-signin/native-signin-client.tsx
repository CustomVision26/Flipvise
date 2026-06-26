"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, useSignIn } from "@clerk/nextjs";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Default landing if the handoff URL doesn't specify a redirect. */
const DEFAULT_REDIRECT = "/dashboard";

/** Only allow same-origin relative paths as redirect targets. */
function safeRedirect(raw: string | null): string {
  if (!raw) return DEFAULT_REDIRECT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_REDIRECT;
  return raw;
}

export function NativeSignInClient() {
  const { isLoaded } = useAuth();
  const { signIn } = useSignIn();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("ticket");
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !signIn || startedRef.current) return;
    startedRef.current = true;

    if (!ticket) {
      setError("This sign-in link is missing or invalid.");
      return;
    }

    const expired =
      "This sign-in link has expired. Please open the dashboard again.";

    (async () => {
      try {
        // New Clerk "future" signals API: exchange the backend sign-in token for
        // a session, then finalize() to set it active before redirecting.
        const { error: ticketError } = await signIn.ticket({ ticket });
        if (ticketError) {
          setError(expired);
          return;
        }
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(expired);
          return;
        }
        // Full navigation so the dashboard renders with the new session cookie.
        window.location.replace(redirectTo);
      } catch {
        setError(expired);
      }
    })();
  }, [isLoaded, signIn, ticket, redirectTo]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        {error ? (
          <>
            <CardHeader className="items-center text-center">
              <ShieldAlert className="size-8 text-destructive" aria-hidden />
              <CardTitle>Couldn&apos;t sign you in</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button render={<a href="/">Go to Flipvise</a>} />
            </CardContent>
          </>
        ) : (
          <CardHeader className="items-center text-center">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            <CardTitle>Signing you in…</CardTitle>
            <CardDescription>
              Taking you to your dashboard. This only takes a moment.
            </CardDescription>
          </CardHeader>
        )}
      </Card>
    </main>
  );
}
