"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authContinueUrl, safeRedirectPath } from "@/lib/safe-redirect-path";
import { waitForServerSession } from "@/lib/native-session-probe";
import {
  isFlipviseNativeApp,
  navigateToOfflineShell,
} from "@/lib/offline/is-flipvise-native-app";

const CLERK_LOAD_TIMEOUT_MS = 10_000;
const REDIRECT_STALL_TIMEOUT_MS = 12_000;
const TICKET_FLOW_TIMEOUT_MS = 25_000;
/** When Clerk JS is stuck refreshing, fall back to server session probe. */
const CLERK_SERVER_SESSION_FALLBACK_MS = 2_500;
/** Show escape actions while Clerk is still loading inside the native app. */
const LOADING_ESCAPE_UI_MS = 4_000;

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

function clerkErrorCode(err: unknown): string | undefined {
  if (!err || typeof err === "string") return undefined;
  const e = err as { code?: string; errors?: Array<{ code?: string }> };
  return e.errors?.[0]?.code ?? e.code;
}

function isUnsupportedPasswordStrategy(err: unknown): boolean {
  const code = clerkErrorCode(err)?.toLowerCase() ?? "";
  const msg = describeClerkError(err).toLowerCase();
  return (
    msg.includes("verification strategy") ||
    code === "strategy_for_user_invalid" ||
    code === "form_password_not_supported"
  );
}

type SignInResource = NonNullable<ReturnType<typeof useSignIn>["signIn"]>;

function signInSupportsStrategy(
  signIn: SignInResource,
  strategy: "password" | "email_code",
): boolean {
  return signIn.supportedFirstFactors?.some((f) => f.strategy === strategy) ?? false;
}

function useTimeoutFlag(active: boolean, ms: number): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!active) {
      setTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setTimedOut(true), ms);
    return () => window.clearTimeout(timer);
  }, [active, ms]);

  return timedOut;
}

function resolveNativeSignInContext(serverNativeContext: boolean): boolean {
  if (serverNativeContext) return true;
  if (typeof window === "undefined") return false;
  return isFlipviseNativeApp();
}

/**
 * In-app sign-in for the Capacitor WebView — no Clerk modal (OOM risk).
 * Always verifies the server session before leaving this page.
 */
export function NativeSignInClient({
  isNativeContext: serverNativeContext = false,
}: {
  isNativeContext?: boolean;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { signIn } = useSignIn();
  const { signOut } = useClerk();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("ticket");
  const sessionRetry = searchParams.get("session_retry") === "1";
  const redirectTo = safeRedirectPath(searchParams.get("redirect"));
  const postAuthTarget = authContinueUrl(redirectTo);
  const isNativeContext = resolveNativeSignInContext(serverNativeContext);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [manualOnly, setManualOnly] = useState(sessionRetry);
  const [continuing, setContinuing] = useState(false);
  const startedRef = useRef(false);
  const continueRef = useRef(false);

  const clerkLoadTimedOut = useTimeoutFlag(!isLoaded, CLERK_LOAD_TIMEOUT_MS);
  const loadingEscapeDue = useTimeoutFlag(
    !isLoaded && !manualOnly && !continuing,
    LOADING_ESCAPE_UI_MS,
  );
  const clerkServerFallbackDue = useTimeoutFlag(
    !isLoaded && !manualOnly && !continuing,
    CLERK_SERVER_SESSION_FALLBACK_MS,
  );
  const redirectStalled = useTimeoutFlag(
    Boolean(continuing),
    REDIRECT_STALL_TIMEOUT_MS,
  );
  const ticketTimedOut = useTimeoutFlag(
    Boolean(isLoaded && ticket && !ticketError && !isSignedIn && !manualOnly),
    TICKET_FLOW_TIMEOUT_MS,
  );

  const finishSignIn = useCallback(async () => {
    if (continueRef.current) return;
    continueRef.current = true;
    setContinuing(true);

    const serverReady = await waitForServerSession(12_000);
    if (!serverReady) {
      continueRef.current = false;
      setContinuing(false);
      await signOut().catch(() => {});
      setManualOnly(true);
      setTicketError(
        "Your sign-in did not fully sync inside the app. Please sign in again below.",
      );
      return;
    }

    try {
      const session = await import("@/lib/offline/session");
      await session.setRequireManualSignIn(false);
    } catch {
      // Non-fatal
    }

    window.location.replace(postAuthTarget);
  }, [postAuthTarget, signOut]);

  // Server cookies can be valid before Clerk JS finishes booting in the WebView.
  useEffect(() => {
    if (manualOnly || sessionRetry || continueRef.current) return;
    void (async () => {
      const serverReady = await waitForServerSession(5_000);
      if (!serverReady || continueRef.current || manualOnly) return;
      continueRef.current = true;
      setContinuing(true);
      window.location.replace(postAuthTarget);
    })();
  }, [manualOnly, postAuthTarget, sessionRetry]);

  // Clerk JS can spin on session refresh in the WebView while SSR cookies are valid.
  useEffect(() => {
    if (!clerkServerFallbackDue || continueRef.current || manualOnly) return;
    void (async () => {
      const serverReady = await waitForServerSession(4_000);
      if (!serverReady || continueRef.current) return;
      continueRef.current = true;
      setContinuing(true);
      window.location.replace(postAuthTarget);
    })();
  }, [clerkServerFallbackDue, manualOnly, postAuthTarget]);

  // Server rejected a prior session — clear client state and show the form.
  useEffect(() => {
    if (!sessionRetry || !isLoaded) return;
    void signOut().then(() => {
      setManualOnly(true);
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("session_retry");
        window.history.replaceState(null, "", url.toString());
      } catch {
        // ignore
      }
    });
  }, [sessionRetry, isLoaded, signOut]);

  // Returning visit: Clerk JS says signed-in — verify server cookies before redirect.
  // Do not block on `ticket`: handoff URLs can arrive while a stale client session exists.
  // Skip when `session_retry` / manual-only — user signed out and must re-authenticate.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || manualOnly || continuing || sessionRetry) return;
    void finishSignIn();
  }, [isLoaded, isSignedIn, manualOnly, continuing, sessionRetry, finishSignIn]);

  // Ticket handoff from offline device sync token.
  useEffect(() => {
    if (
      !isLoaded ||
      isSignedIn ||
      !ticket ||
      !signIn ||
      startedRef.current ||
      manualOnly
    ) {
      return;
    }
    startedRef.current = true;

    const expired = "This sign-in link has expired. Please sign in below.";
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
        await finishSignIn();
      } catch {
        setTicketError(expired);
      }
    })();
  }, [isLoaded, isSignedIn, ticket, signIn, manualOnly, finishSignIn]);

  if (manualOnly && isLoaded) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6">
        <SignInForm
          redirectTo={postAuthTarget}
          notice={
            ticketError ??
            "Please sign in to open the online dashboard."
          }
          onFinishSignIn={finishSignIn}
          isNativeContext={isNativeContext}
        />
      </main>
    );
  }

  if (clerkLoadTimedOut && !isLoaded) {
    return (
      <SignInRecovery
        title="Sign-in is taking too long"
        description="Clerk could not finish loading inside the app. Check your connection, make sure the dev server is running, then try again — or return to offline study."
        showSignOut={false}
        isNativeContext={isNativeContext}
      />
    );
  }

  if (redirectStalled && continuing) {
    return (
      <SignInRecovery
        title="Could not open the dashboard"
        description="Sign-in synced slowly. Try again or sign in manually."
        showSignOut
        isNativeContext={isNativeContext}
      />
    );
  }

  if (ticketTimedOut && ticket && !ticketError) {
    return (
      <SignInRecovery
        title="Automatic sign-in timed out"
        description="Your saved device sign-in did not finish in time. Try again or sign in manually below."
        showSignOut={false}
        isNativeContext={isNativeContext}
        onContinue={() =>
          setTicketError("Automatic sign-in timed out. Sign in below.")
        }
        continueLabel="Sign in manually"
      />
    );
  }

  if (continuing || !isLoaded || isSignedIn) {
    return (
      <CenteredSpinner
        label={
          continuing || isSignedIn ? "Opening dashboard…" : "Connecting to sign-in…"
        }
        isNativeContext={isNativeContext}
        showEscapeActions={loadingEscapeDue || isNativeContext}
      />
    );
  }

  if (ticket && !ticketError) {
    return (
      <CenteredSpinner
        label="Signing you in…"
        isNativeContext={isNativeContext}
        showEscapeActions={loadingEscapeDue || isNativeContext}
      />
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <SignInForm
        redirectTo={postAuthTarget}
        notice={ticketError}
        onFinishSignIn={finishSignIn}
        isNativeContext={isNativeContext}
      />
    </main>
  );
}

function CenteredSpinner({
  label,
  isNativeContext,
  showEscapeActions = false,
}: {
  label?: string;
  isNativeContext: boolean;
  showEscapeActions?: boolean;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <CardTitle>{label ?? "Loading…"}</CardTitle>
          <CardDescription>This only takes a moment.</CardDescription>
        </CardHeader>
        {showEscapeActions ? (
          <CardFooter className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                if (isNativeContext) {
                  window.location.href = "/api/auth/clear-stale-session";
                  return;
                }
                window.location.reload();
              }}
            >
              Try again
            </Button>
            {isNativeContext ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  void navigateToOfflineShell();
                }}
              >
                Back to offline study
              </Button>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    </main>
  );
}

function SignInRecovery({
  title,
  description,
  showSignOut,
  onContinue,
  continueLabel,
  isNativeContext,
}: {
  title: string;
  description: string;
  showSignOut: boolean;
  onContinue?: () => void;
  continueLabel?: string;
  isNativeContext: boolean;
}) {
  const { signOut } = useClerk();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-2">
          {onContinue ? (
            <Button type="button" className="w-full" onClick={onContinue}>
              {continueLabel ?? "Continue"}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (isNativeContext) {
                  window.location.href = "/api/auth/clear-stale-session";
                  return;
                }
                window.location.reload();
              }}
            >
              Try again
            </Button>
          )}
          {showSignOut ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                void signOut().then(() => window.location.reload());
              }}
            >
              Sign out and try again
            </Button>
          ) : null}
          {isNativeContext ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                void navigateToOfflineShell();
              }}
            >
              Back to offline study
            </Button>
          ) : null}
        </CardFooter>
      </Card>
    </main>
  );
}

type Step = "identify" | "code";

function SignInForm({
  redirectTo,
  notice,
  onFinishSignIn,
  isNativeContext,
}: {
  redirectTo: string;
  notice: string | null;
  onFinishSignIn: () => Promise<void>;
  isNativeContext: boolean;
}) {
  const { signIn } = useSignIn();
  const [mode, setMode] = useState<"password" | "code">("code");
  const [step, setStep] = useState<Step>("identify");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  useEffect(() => {
    if (isNativeContext) {
      setMode("code");
    }
  }, [isNativeContext]);

  useEffect(() => {
    setError(notice);
  }, [notice]);

  const fail = (label: string, raw: unknown) => {
    const detail = describeClerkError(raw);
    console.error(`[native-signin] ${label}:`, raw);
    setError(detail ? `${label}: ${detail}` : label);
  };

  async function complete(): Promise<boolean> {
    if (!signIn) return false;
    const { error: finalizeErr } = await signIn.finalize();
    if (finalizeErr) {
      fail("Couldn't finish sign-in", finalizeErr);
      return false;
    }
    await onFinishSignIn();
    return true;
  }

  async function beginEmailCodeFlow(
    noticeMessage?: string,
    skipCreate = false,
  ): Promise<boolean> {
    if (!signIn || !email.trim()) return false;
    if (!skipCreate) {
      const { error: createErr } = await signIn.create({
        identifier: email.trim(),
      });
      if (createErr) {
        fail("Couldn't start sign-in", createErr);
        return false;
      }
    }
    if (!signInSupportsStrategy(signIn, "email_code")) {
      setError(
        "This account does not support email codes (for example Google-only sign-in). Open Flipvise in your mobile browser or on desktop to sign in with your provider, then return to the app.",
      );
      return false;
    }
    const { error: sendErr } = await signIn.emailCode.sendCode();
    if (sendErr) {
      fail("Couldn't send code", sendErr);
      return false;
    }
    setMode("code");
    setStep("code");
    setError(noticeMessage ?? null);
    return true;
  }

  async function onPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || busy || !signIn) return;
    setBusy(true);
    setError(null);
    try {
      const { error: createErr } = await signIn.create({
        identifier: email.trim(),
      });
      if (createErr) {
        fail("Sign-in failed", createErr);
        return;
      }

      if (!signInSupportsStrategy(signIn, "password")) {
        await beginEmailCodeFlow(
          "This account does not use a password. Enter the code we sent to your email.",
          true,
        );
        return;
      }

      const { error: pwErr } = await signIn.password({ password });
      if (pwErr) {
        if (isUnsupportedPasswordStrategy(pwErr) && signInSupportsStrategy(signIn, "email_code")) {
          await beginEmailCodeFlow(
            "This account does not use a password. Enter the code we sent to your email.",
            true,
          );
          return;
        }
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
    if (!email || busy || !signIn) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await beginEmailCodeFlow();
      if (!ok) return;
    } catch (err) {
      fail("Couldn't send code", err);
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code || busy || !signIn) return;
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
            : isNativeContext
              ? "Most accounts use an email sign-in code. Password sign-in works only if you created one on the web."
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
      {isNativeContext ? (
        <CardFooter>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              void navigateToOfflineShell();
            }}
          >
            Back to offline study
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
