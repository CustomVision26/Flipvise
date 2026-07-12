"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { ensureWelcomeInboxMessageAction } from "@/actions/inbox";
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
import { markClerkAuthHandoff } from "@/lib/clerk-auth-handoff";
import { waitForServerSession } from "@/lib/native-session-probe";
import {
  isFlipviseNativeApp,
  navigateToOfflineShellFast,
} from "@/lib/offline/is-flipvise-native-app";

const CLERK_LOAD_TIMEOUT_MS = 6_000;
const REDIRECT_STALL_TIMEOUT_MS = 12_000;
const TICKET_FLOW_TIMEOUT_MS = 25_000;
/** Probe server session once on mount — avoids stacked probes that freeze the WebView. */
const SERVER_SESSION_PROBE_MS = 5_000;
/** Show escape actions immediately in the native app (server escape bar is the fallback). */
const LOADING_ESCAPE_UI_MS = 0;

const NATIVE_BTN_CLASS =
  "min-h-11 w-full touch-manipulation active:scale-[0.98] transition-transform";

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

function isAccountNotFoundError(err: unknown): boolean {
  const code = clerkErrorCode(err)?.toLowerCase() ?? "";
  const msg = describeClerkError(err).toLowerCase();
  return (
    code === "form_identifier_not_found" ||
    msg.includes("couldn't find your account") ||
    msg.includes("could not find your account")
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

    markClerkAuthHandoff();

    window.location.replace(postAuthTarget);
  }, [postAuthTarget, signOut]);

  // Single server-session probe on mount — valid cookies can exist before Clerk JS boots.
  useEffect(() => {
    if (manualOnly || sessionRetry || continueRef.current) return;

    let cancelled = false;
    void (async () => {
      const serverReady = await waitForServerSession(SERVER_SESSION_PROBE_MS);
      if (cancelled || !serverReady || continueRef.current || manualOnly) return;
      continueRef.current = true;
      setContinuing(true);
      window.location.replace(postAuthTarget);
    })();

    return () => {
      cancelled = true;
    };
  }, [manualOnly, postAuthTarget, sessionRetry]);

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
      <main
        className={`flex min-h-dvh items-center justify-center bg-background p-6${isNativeContext ? " pb-36" : ""}`}
      >
        <NativeAuthForm
          redirectTo={postAuthTarget}
          notice={
            ticketError ??
            "Please sign in to open the online dashboard."
          }
          onFinishAuth={finishSignIn}
          isNativeContext={isNativeContext}
        />
      </main>
    );
  }

  if (clerkLoadTimedOut && !isLoaded) {
    return (
      <SignInRecovery
        title="Sign-in is taking too long"
        description={
          isNativeContext
            ? "Sign-in could not connect. Tap the refresh icon in the top-left corner, or use Back to offline study at the bottom."
            : "Clerk could not finish loading inside the app. Check your connection, make sure the dev server is running, then try again — or return to offline study."
        }
        showSignOut={false}
        isNativeContext={isNativeContext}
      />
    );
  }

  if (redirectStalled && continuing) {
    return (
      <SignInRecovery
        title="Could not open the dashboard"
        description="Sign-in synced slowly. Tap the refresh icon in the top-left corner to try again."
        showSignOut
        isNativeContext={isNativeContext}
      />
    );
  }

  if (ticketTimedOut && ticket && !ticketError) {
    return (
      <SignInRecovery
        title="Automatic sign-in timed out"
        description="Your saved device sign-in did not finish in time. Tap the refresh icon in the top-left corner, or sign in manually below."
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
        showEscapeActions={!isNativeContext && (loadingEscapeDue || false)}
      />
    );
  }

  if (ticket && !ticketError) {
    return (
      <CenteredSpinner
        label="Signing you in…"
        isNativeContext={isNativeContext}
        showEscapeActions={!isNativeContext && (loadingEscapeDue || false)}
      />
    );
  }

  return (
    <main
      className={`flex min-h-dvh items-center justify-center bg-background p-6${isNativeContext ? " pb-36" : ""}`}
    >
      <NativeAuthForm
        redirectTo={postAuthTarget}
        notice={ticketError}
        onFinishAuth={finishSignIn}
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
    <main
      className={`flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6${isNativeContext ? " pb-36" : ""}`}
    >
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
          <CardTitle>{label ?? "Loading…"}</CardTitle>
          <CardDescription>
            {isNativeContext
              ? "If this takes more than a few seconds, tap the refresh icon in the top-left corner."
              : "This only takes a moment."}
          </CardDescription>
        </CardHeader>
        {showEscapeActions ? (
          <CardFooter className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              className={NATIVE_BTN_CLASS}
              onPointerDown={() => {
                window.location.href = "/api/auth/clear-stale-session";
              }}
            >
              Try again
            </Button>
            {isNativeContext ? (
              <Button
                type="button"
                variant="outline"
                className={NATIVE_BTN_CLASS}
                onPointerDown={() => {
                  navigateToOfflineShellFast();
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
    <main
      className={`flex min-h-dvh items-center justify-center bg-background p-6${isNativeContext ? " pb-36" : ""}`}
    >
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {!isNativeContext || onContinue || showSignOut ? (
        <CardFooter className="flex flex-col gap-2">
          {onContinue ? (
            <Button
              type="button"
              className={NATIVE_BTN_CLASS}
              onPointerDown={onContinue}
            >
              {continueLabel ?? "Continue"}
            </Button>
          ) : !isNativeContext ? (
            <Button
              type="button"
              className={NATIVE_BTN_CLASS}
              onPointerDown={() => {
                window.location.reload();
              }}
            >
              Try again
            </Button>
          ) : null}
          {showSignOut ? (
            <Button
              type="button"
              variant="secondary"
              className={NATIVE_BTN_CLASS}
              onPointerDown={() => {
                void signOut().then(() => window.location.reload());
              }}
            >
              Sign out and try again
            </Button>
          ) : null}
        </CardFooter>
        ) : null}
      </Card>
    </main>
  );
}

type Step = "identify" | "code";
type AuthMode = "sign-in" | "sign-up";

function NativeAuthForm({
  redirectTo,
  notice,
  onFinishAuth,
  isNativeContext,
}: {
  redirectTo: string;
  notice: string | null;
  onFinishAuth: () => Promise<void>;
  isNativeContext: boolean;
}) {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [prefillEmail, setPrefillEmail] = useState("");

  const switchToSignUp = useCallback((email?: string) => {
    void signIn?.reset?.();
    if (email) setPrefillEmail(email);
    setAuthMode("sign-up");
  }, [signIn]);

  const switchToSignIn = useCallback((email?: string) => {
    void signUp?.reset?.();
    if (email) setPrefillEmail(email);
    setAuthMode("sign-in");
  }, [signUp]);

  if (authMode === "sign-up") {
    return (
      <SignUpForm
        notice={notice}
        initialEmail={prefillEmail}
        onFinishSignUp={onFinishAuth}
        onSwitchToSignIn={switchToSignIn}
        isNativeContext={isNativeContext}
      />
    );
  }

  return (
    <SignInForm
      redirectTo={redirectTo}
      notice={notice}
      initialEmail={prefillEmail}
      onFinishSignIn={onFinishAuth}
      onSwitchToSignUp={switchToSignUp}
      isNativeContext={isNativeContext}
    />
  );
}

function SignInForm({
  redirectTo,
  notice,
  initialEmail = "",
  onFinishSignIn,
  onSwitchToSignUp,
  isNativeContext,
}: {
  redirectTo: string;
  notice: string | null;
  initialEmail?: string;
  onFinishSignIn: () => Promise<void>;
  onSwitchToSignUp: (email?: string) => void;
  isNativeContext: boolean;
}) {
  const { signIn } = useSignIn();
  const [mode, setMode] = useState<"password" | "code">("code");
  const [step, setStep] = useState<Step>("identify");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);
  const [accountNotFound, setAccountNotFound] = useState(false);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

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
    setAccountNotFound(isAccountNotFoundError(raw));
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
    setAccountNotFound(false);
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
    setAccountNotFound(false);
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
          <div className="flex flex-col gap-2">
            <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
            {accountNotFound ? (
              <Button
                type="button"
                variant="secondary"
                className={NATIVE_BTN_CLASS}
                disabled={busy}
                onClick={() => onSwitchToSignUp(email.trim())}
              >
                Create an account with this email
              </Button>
            ) : null}
          </div>
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
                setAccountNotFound(false);
              }}
            >
              Email me a code instead
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onSwitchToSignUp(email.trim())}
            >
              New to Flipvise? Create an account
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
                setAccountNotFound(false);
              }}
            >
              Use a password instead
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onSwitchToSignUp(email.trim())}
            >
              New to Flipvise? Create an account
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

function SignUpForm({
  notice,
  initialEmail = "",
  onFinishSignUp,
  onSwitchToSignIn,
  isNativeContext,
}: {
  notice: string | null;
  initialEmail?: string;
  onFinishSignUp: () => Promise<void>;
  onSwitchToSignIn: (email?: string) => void;
  isNativeContext: boolean;
}) {
  const { signUp } = useSignUp();
  const [step, setStep] = useState<Step>("identify");
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    setError(notice);
  }, [notice]);

  const fail = (label: string, raw: unknown) => {
    const detail = describeClerkError(raw);
    console.error(`[native-signup] ${label}:`, raw);
    setError(detail ? `${label}: ${detail}` : label);
  };

  async function complete(): Promise<boolean> {
    if (!signUp) return false;
    const { error: finalizeErr } = await signUp.finalize();
    if (finalizeErr) {
      fail("Couldn't finish sign-up", finalizeErr);
      return false;
    }
    void ensureWelcomeInboxMessageAction().catch(() => {});
    await onFinishSignUp();
    return true;
  }

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!email || busy || !signUp) return;
    setBusy(true);
    setError(null);
    try {
      const { error: createErr } = await signUp.create({
        emailAddress: email.trim(),
      });
      if (createErr) {
        fail("Couldn't start sign-up", createErr);
        return;
      }
      const { error: sendErr } = await signUp.verifications.sendEmailCode();
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
    if (!code || busy || !signUp) return;
    setBusy(true);
    setError(null);
    try {
      const { error: verifyErr } = await signUp.verifications.verifyEmailCode({
        code: code.trim(),
      });
      if (verifyErr) {
        fail("Code verification failed", verifyErr);
        return;
      }
      if (signUp.status !== "complete") {
        fail("Sign-up incomplete", { message: "Please try again." });
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
        <CardTitle>Create your Flipvise account</CardTitle>
        <CardDescription>
          {step === "code"
            ? `Enter the code we emailed to ${email}.`
            : isNativeContext
              ? "Enter your email and we'll send a verification code to create your account."
              : "Use your email to create an account and open the dashboard."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}

        {step === "identify" ? (
          <form onSubmit={onSendCode} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <div id="clerk-captcha" />
            <Button type="submit" disabled={busy} className="mt-1">
              {busy ? "Sending…" : "Email me a code"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onSwitchToSignIn(email.trim())}
            >
              Already have an account? Sign in
            </Button>
          </form>
        ) : (
          <form onSubmit={onVerifyCode} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-code">Verification code</Label>
              <Input
                id="signup-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(ev) => setCode(ev.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="mt-1">
              {busy ? "Verifying…" : "Verify & create account"}
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
