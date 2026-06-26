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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Default landing if the handoff URL doesn't specify a redirect. */
const DEFAULT_REDIRECT = "/dashboard";

/** Only allow same-origin relative paths as redirect targets. */
function safeRedirect(raw: string | null): string {
  if (!raw) return DEFAULT_REDIRECT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_REDIRECT;
  return raw;
}

/** Pull a human-readable message out of a Clerk error object or thrown error. */
function describeClerkError(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as {
    message?: string;
    longMessage?: string;
    code?: string;
    errors?: Array<{ longMessage?: string; message?: string; code?: string }>;
  };
  const first = e.errors?.[0];
  return (
    first?.longMessage ||
    first?.message ||
    (first?.code ? `(${first.code})` : "") ||
    e.longMessage ||
    e.message ||
    (e.code ? `(${e.code})` : "") ||
    ""
  );
}

/**
 * In-app sign-in for the native (Capacitor) WebView. Avoids Clerk's heavy modal
 * (which crashed the WebView renderer) by signing in programmatically:
 *  - already signed in → redirect to `redirect`
 *  - `ticket` present (returning device) → exchange the sign-in token for a session
 *  - otherwise → a lightweight email/password (or email-code) form
 */
export function NativeSignInClient() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("ticket");
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const [ticketError, setTicketError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // Already authenticated in this WebView session — go straight through.
  useEffect(() => {
    if (isLoaded && isSignedIn) window.location.replace(redirectTo);
  }, [isLoaded, isSignedIn, redirectTo]);

  // Ticket handoff: exchange the backend sign-in token for a session.
  useEffect(() => {
    if (!isLoaded || isSignedIn || !ticket || !signIn || startedRef.current) {
      return;
    }
    startedRef.current = true;

    const expired =
      "This sign-in link has expired. Please sign in below.";
    (async () => {
      try {
        const { error: ticketErr } = await signIn.ticket({ ticket });
        if (ticketErr) {
          setTicketError(expired);
          return;
        }
        const { error: finalizeErr } = await signIn.finalize();
        if (finalizeErr) {
          setTicketError(expired);
          return;
        }
        window.location.replace(redirectTo);
      } catch {
        setTicketError(expired);
      }
    })();
  }, [isLoaded, isSignedIn, ticket, signIn, redirectTo]);

  // While Clerk loads, or while we redirect an already-signed-in session.
  if (!isLoaded || isSignedIn) {
    return <CenteredSpinner />;
  }

  // Ticket flow in progress (and not yet failed).
  if (ticket && !ticketError) {
    return <CenteredSpinner label="Signing you in…" />;
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <SignInForm redirectTo={redirectTo} notice={ticketError} />
    </main>
  );
}

function CenteredSpinner({ label }: { label?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <CardTitle>{label ?? "Loading…"}</CardTitle>
          <CardDescription>This only takes a moment.</CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

type Step = "identify" | "code";

function SignInForm({
  redirectTo,
  notice,
}: {
  redirectTo: string;
  notice: string | null;
}) {
  const { signIn } = useSignIn();
  const [mode, setMode] = useState<"password" | "code">("password");
  const [step, setStep] = useState<Step>("identify");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  const fail = (label: string, raw: unknown) => {
    const detail = describeClerkError(raw);
    console.error(`[native-signin] ${label}:`, raw);
    setError(detail ? `${label}: ${detail}` : label);
  };

  async function complete(): Promise<boolean> {
    const { error: finalizeErr } = await signIn.finalize();
    if (finalizeErr) {
      fail("Couldn't finish sign-in", finalizeErr);
      return false;
    }
    window.location.replace(redirectTo);
    return true;
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: pwErr } = await signIn.password({
        identifier: email.trim(),
        password,
      });
      if (pwErr) {
        fail("Sign-in failed", pwErr);
        return;
      }
      await complete();
    } catch (err) {
      fail("Sign-in error", err);
    } finally {
      setBusy(false);
    }
  }

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: createErr } = await signIn.create({
        identifier: email.trim(),
      });
      if (createErr) {
        fail("Couldn't start sign-in", createErr);
        return;
      }
      const { error: sendErr } = await signIn.emailCode.sendCode();
      if (sendErr) {
        fail("Couldn't send code", sendErr);
        return;
      }
      setStep("code");
    } catch (err) {
      fail("Couldn't send code", err);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyErr } = await signIn.emailCode.verifyCode({
        code: code.trim(),
      });
      if (verifyErr) {
        fail("Code verification failed", verifyErr);
        return;
      }
      await complete();
    } catch (err) {
      fail("Verification error", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle>Sign in to Flipvise</CardTitle>
        <CardDescription>
          {mode === "code" && step === "code"
            ? `Enter the code we emailed to ${email}.`
            : "Use your email to continue to the dashboard."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}

        {mode === "password" ? (
          <form onSubmit={onPasswordSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="mt-1">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setMode("code");
                setStep("identify");
                setError(null);
              }}
            >
              Email me a code instead
            </Button>
          </form>
        ) : step === "identify" ? (
          <form onSubmit={onSendCode} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email-code">Email</Label>
              <Input
                id="email-code"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="mt-1">
              {busy ? "Sending…" : "Email me a code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setMode("password");
                setError(null);
              }}
            >
              Use a password instead
            </Button>
          </form>
        ) : (
          <form onSubmit={onVerifyCode} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(ev) => setCode(ev.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="mt-1">
              {busy ? "Verifying…" : "Verify & sign in"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setStep("identify");
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
