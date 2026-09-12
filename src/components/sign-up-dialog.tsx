"use client";

import { useEffect, useState } from "react";
import { useAuth, useSignUp } from "@clerk/nextjs";
import { ChevronRight, Eye, EyeOff, Loader2, Pencil, ShieldAlert } from "lucide-react";
import { ensureWelcomeInboxMessageAction } from "@/actions/welcome-inbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { markClerkAuthHandoff } from "@/lib/clerk-auth-handoff";
import {
  FLIPVISE_OPEN_SIGN_UP_EVENT,
  type OpenFlipviseSignUpDetail,
} from "@/lib/flipvise-sign-up";
import { authContinueUrl, DEFAULT_AUTH_REDIRECT } from "@/lib/safe-redirect-path";
import { cn } from "@/lib/utils";

const VERIFICATION_CODE_LENGTH = 6;
const RESEND_CODE_COOLDOWN_SEC = 30;

function SignUpResendCodeControl({
  onResend,
  disabled,
}: {
  onResend: () => Promise<void>;
  disabled?: boolean;
}) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_CODE_COOLDOWN_SEC);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(
      () => setSecondsLeft((prev) => Math.max(0, prev - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  async function handleResend() {
    if (secondsLeft > 0 || resending || disabled) return;
    setResending(true);
    try {
      await onResend();
      setSecondsLeft(RESEND_CODE_COOLDOWN_SEC);
    } catch {
      // Error is already shown in the dialog.
    } finally {
      setResending(false);
    }
  }

  return (
    <p className="text-center text-sm text-muted-foreground" aria-live="polite">
      Didn’t receive a code?{" "}
      {secondsLeft > 0 ? (
        <span>Resend ({secondsLeft})</span>
      ) : (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 text-foreground"
          disabled={resending || disabled}
          onClick={() => {
            void handleResend();
          }}
        >
          {resending ? "Sending…" : "Resend"}
        </Button>
      )}
    </p>
  );
}

function describeClerkError(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  const e = err as {
    message?: string;
    longMessage?: string;
    errors?: Array<{ longMessage?: string; message?: string }>;
  };
  if (e.errors?.[0]?.longMessage) return e.errors[0].longMessage;
  if (e.errors?.[0]?.message) return e.errors[0].message;
  if (e.longMessage) return e.longMessage;
  if (e.message) return e.message;
  return "Something went wrong. Please try again.";
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password";
  disabled?: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          required
          className="pr-10"
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-0 right-0 size-8 text-muted-foreground hover:text-foreground"
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </Button>
      </div>
    </div>
  );
}

export function SignUpDialog({
  size,
  initialEmail = "",
  triggerLabel = "Sign Up",
  redirectPath = DEFAULT_AUTH_REDIRECT,
  showTrigger = true,
}: {
  size?: "default" | "sm" | "lg" | "xs";
  initialEmail?: string;
  triggerLabel?: string;
  redirectPath?: string;
  /** When false, only the global host / `openFlipviseSignUp()` opens the dialog. */
  showTrigger?: boolean;
}) {
  // Clerk's useSignUp no longer exposes `isLoaded` (SignUpSignalValue).
  const { isLoaded } = useAuth();
  const { signUp } = useSignUp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"details" | "code">("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    function onOpen(event: Event) {
      const email = (event as CustomEvent<OpenFlipviseSignUpDetail>).detail
        ?.email;
      if (typeof email === "string" && email.trim()) {
        setEmail(email.trim());
      }
      setOpen(true);
    }
    window.addEventListener(FLIPVISE_OPEN_SIGN_UP_EVENT, onOpen);
    return () => {
      window.removeEventListener(FLIPVISE_OPEN_SIGN_UP_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setStep("details");
      setCode("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  function fail(label: string, raw?: unknown) {
    const detail = raw != null ? describeClerkError(raw) : "";
    setError(detail ? `${label}: ${detail}` : label);
  }

  async function finishSignUp() {
    if (!signUp) return false;
    const { error: finalizeErr } = await signUp.finalize();
    if (finalizeErr) {
      fail("Couldn't finish sign-up", finalizeErr);
      return false;
    }

    // Contact / account type / security questions are collected on
    // /onboarding/account-recovery after the account exists.
    void ensureWelcomeInboxMessageAction().catch(() => {});
    markClerkAuthHandoff();
    setOpen(false);
    window.location.assign(authContinueUrl(redirectPath));
    return true;
  }

  async function onSubmitDetails(event: React.FormEvent) {
    event.preventDefault();
    if (!isLoaded || !signUp || busy) return;

    if (password !== passwordConfirmation) {
      setError("Password confirmation does not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { error: createErr } = await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      if (createErr) {
        fail("Couldn't start sign-up", createErr);
        return;
      }

      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) {
        fail("Couldn't send verification code", sendErr);
        return;
      }
      setStep("code");
    } catch (err) {
      fail("Couldn't start sign-up", err);
    } finally {
      setBusy(false);
    }
  }

  async function verifyWithCode(codeValue: string) {
    const trimmed = codeValue.trim();
    if (!trimmed || !isLoaded || !signUp || busy) return;

    setBusy(true);
    setError(null);
    try {
      const { error: verifyErr } = await signUp.verifications.verifyEmailCode({
        code: trimmed,
      });
      if (verifyErr) {
        fail("Code verification failed", verifyErr);
        return;
      }
      if (signUp.status !== "complete") {
        fail("Sign-up incomplete. Please try again.");
        return;
      }
      await finishSignUp();
    } catch (err) {
      fail("Verification error", err);
    } finally {
      setBusy(false);
    }
  }

  async function resendEmailCode() {
    if (!isLoaded || !signUp) return;
    const { error: sendErr } = await signUp.verifications.sendEmailCode();
    if (sendErr) {
      fail("Couldn't resend verification code", sendErr);
      throw sendErr;
    }
  }

  function backToDetails() {
    setStep("details");
    setCode("");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger render={<Button size={size} disabled={!isLoaded} />}>
          {triggerLabel}
        </DialogTrigger>
      ) : null}
      <DialogContent
        className={cn(
          "max-h-[min(90vh,820px)] overflow-y-auto",
          step === "code" ? "sm:max-w-sm" : "sm:max-w-lg",
        )}
      >
        <DialogHeader className={step === "code" ? "items-center text-center" : undefined}>
          {step === "code" ? (
            <>
              <DialogTitle>Check your email</DialogTitle>
              <DialogDescription>to continue to Flipvise</DialogDescription>
              <div className="flex items-center justify-center gap-1 text-sm font-medium text-foreground">
                <span className="truncate">{email}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Change email"
                  disabled={busy}
                  onClick={backToDetails}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogTitle>Create your account</DialogTitle>
              <DialogDescription>
                Welcome! Enter your name, email, and password. After verification you’ll complete
                contact details and security questions.
              </DialogDescription>
            </>
          )}
        </DialogHeader>

        {error ? (
          <p className="flex items-start gap-2 rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}

        {step === "details" ? (
          <form onSubmit={onSubmitDetails} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-first-name">First name</Label>
                <Input
                  id="signup-first-name"
                  type="text"
                  autoComplete="given-name"
                  placeholder="First name"
                  value={firstName}
                  disabled={busy}
                  required
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-last-name">Last name</Label>
                <Input
                  id="signup-last-name"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Last name"
                  value={lastName}
                  disabled={busy}
                  required
                  onChange={(event) => setLastName(event.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-email">Email address</Label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="Enter your email address"
                value={email}
                disabled={busy}
                required
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <PasswordField
              id="signup-password"
              label="Password"
              placeholder="Create a password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              disabled={busy}
            />

            <PasswordField
              id="signup-password-confirm"
              label="Confirm password"
              placeholder="Confirm your password"
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={setPasswordConfirmation}
              disabled={busy}
            />

            <div id="clerk-captcha" />

            <Button type="submit" disabled={busy || !isLoaded} className="mt-1 w-full">
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Creating account…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void verifyWithCode(code);
            }}
            className="flex flex-col items-center gap-4"
          >
            <InputOTP
              id="signup-verification-code"
              maxLength={VERIFICATION_CODE_LENGTH}
              value={code}
              disabled={busy}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="\d*"
              containerClassName="justify-center"
              aria-label="Verification code"
              onChange={(next) => {
                const digits = next
                  .replace(/\D/g, "")
                  .slice(0, VERIFICATION_CODE_LENGTH);
                setCode(digits);
                if (digits.length === VERIFICATION_CODE_LENGTH) {
                  void verifyWithCode(digits);
                }
              }}
            >
              <InputOTPGroup>
                {Array.from({ length: VERIFICATION_CODE_LENGTH }, (_, index) => (
                  <InputOTPSlot
                    key={index}
                    index={index}
                    className="size-11 text-base font-medium"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
            <SignUpResendCodeControl
              disabled={busy || !isLoaded}
              onResend={resendEmailCode}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={busy || code.length < VERIFICATION_CODE_LENGTH}
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Verifying…
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="size-4" aria-hidden />
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={backToDetails}
            >
              Use another method
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
