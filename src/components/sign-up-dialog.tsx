"use client";

import { useEffect, useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { saveAccountRecoveryProfileAction } from "@/actions/account-recovery-profile";
import { ensureWelcomeInboxMessageAction } from "@/actions/welcome-inbox";
import { AccountRecoveryFields } from "@/components/account-recovery-fields";
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
import {
  emptyAccountRecoveryFieldsValue,
  parseAccountRecoveryFieldsValue,
  type AccountRecoveryFieldsValue,
} from "@/lib/account-recovery-form-helpers";
import { markClerkAuthHandoff } from "@/lib/clerk-auth-handoff";
import { authContinueUrl, DEFAULT_AUTH_REDIRECT } from "@/lib/safe-redirect-path";

const VERIFICATION_CODE_LENGTH = 6;

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
}: {
  size?: "default" | "sm" | "lg" | "xs";
  initialEmail?: string;
  triggerLabel?: string;
  redirectPath?: string;
}) {
  const { isLoaded, signUp } = useSignUp();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"details" | "code">("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [recovery, setRecovery] = useState<AccountRecoveryFieldsValue>(
    emptyAccountRecoveryFieldsValue,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialEmail) setEmail(initialEmail);
  }, [initialEmail]);

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

    const parsed = await parseAccountRecoveryFieldsValue(recovery);
    if (!parsed.success) {
      fail(parsed.error);
      return false;
    }

    try {
      await saveAccountRecoveryProfileAction(parsed.data);
    } catch {
      // Session exists — finish via onboarding so recovery details are not skipped.
      void ensureWelcomeInboxMessageAction().catch(() => {});
      markClerkAuthHandoff();
      setOpen(false);
      window.location.assign(authContinueUrl(redirectPath));
      return true;
    }

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

    const parsed = await parseAccountRecoveryFieldsValue(recovery);
    if (!parsed.success) {
      setError(parsed.error);
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
        unsafeMetadata: {
          accountType: parsed.data.accountType,
          organizationName: parsed.data.organizationName,
          recoveryPhone: parsed.data.phoneNumber,
          mailingAddress: {
            streetAddress: parsed.data.mailingAddress.streetAddress,
            city: parsed.data.mailingAddress.city,
            stateProvince: parsed.data.mailingAddress.stateProvince,
            postalCode: parsed.data.mailingAddress.postalCode,
            country: parsed.data.mailingAddress.country,
          },
        },
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size={size} disabled={!isLoaded} />}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[min(90vh,820px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create your account</DialogTitle>
          <DialogDescription>
            {step === "code"
              ? `Enter the verification code we sent to ${email}.`
              : "Welcome! Add phone, type/status, 3 security questions, and password confirmation. These are required before your personal dashboard unlocks."}
          </DialogDescription>
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

            <AccountRecoveryFields
              idPrefix="signup"
              value={recovery}
              onChange={setRecovery}
              disabled={busy}
              nestedInModal
            />

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
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="signup-verification-code">Verification code</Label>
              <InputOTP
                id="signup-verification-code"
                maxLength={VERIFICATION_CODE_LENGTH}
                value={code}
                disabled={busy}
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="\d*"
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
                <InputOTPGroup className="w-full justify-between gap-1.5">
                  {Array.from({ length: VERIFICATION_CODE_LENGTH }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button type="submit" disabled={busy || code.length < VERIFICATION_CODE_LENGTH}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Verifying…
                </>
              ) : (
                "Verify and continue"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setStep("details");
                setCode("");
                setError(null);
              }}
            >
              Back to details
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
