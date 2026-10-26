"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2, ShieldAlert } from "lucide-react";
import { saveAccountRecoveryProfileAction } from "@/actions/account-recovery-profile";
import { AccountRecoveryFields } from "@/components/account-recovery-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ACCOUNT_RECOVERY_FIELD_STEPS,
  emptyAccountRecoveryFieldsValue,
  parseAccountRecoveryFieldsValue,
  validateAccountRecoveryStep,
  type AccountRecoveryFieldStepId,
  type AccountRecoveryFieldsValue,
} from "@/lib/account-recovery-form-helpers";

export function AccountRecoveryOnboardingForm({
  redirectTo,
}: {
  redirectTo: string;
}) {
  const [profile, setProfile] = useState<AccountRecoveryFieldsValue>(
    emptyAccountRecoveryFieldsValue,
  );
  const [step, setStep] = useState<AccountRecoveryFieldStepId>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepMeta = ACCOUNT_RECOVERY_FIELD_STEPS[step - 1]!;
  const isLastStep = step === ACCOUNT_RECOVERY_FIELD_STEPS.length;

  async function saveProfile() {
    const parsed = await parseAccountRecoveryFieldsValue(profile);
    if (!parsed.success) {
      setError(parsed.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await saveAccountRecoveryProfileAction(parsed.data);
      window.location.assign(redirectTo);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save your account details. Please try again.",
      );
      setBusy(false);
    }
  }

  async function onContinue(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const stepCheck = await validateAccountRecoveryStep(step, profile);
    if (!stepCheck.success) {
      setError(stepCheck.error);
      return;
    }

    setError(null);

    if (!isLastStep) {
      setStep((current) => (current + 1) as AccountRecoveryFieldStepId);
      return;
    }

    await saveProfile();
  }

  function onBack() {
    if (busy || step <= 1) return;
    setError(null);
    setStep((current) => (current - 1) as AccountRecoveryFieldStepId);
  }

  return (
    <Card className="account-recovery-card relative w-full max-w-xl overflow-visible shadow-none ring-0">
      <Image
        src="/artwork/home/account-owl.png"
        alt=""
        width={240}
        height={240}
        className="account-recovery-owl"
        unoptimized
      />
      <CardHeader className="account-recovery-header space-y-4 pb-2">
        <div className="space-y-2">
          <CardTitle className="account-recovery-title text-2xl font-bold tracking-tight">
            Account information
          </CardTitle>
          <CardDescription className="account-recovery-copy text-sm leading-relaxed">
            Step {step} of {ACCOUNT_RECOVERY_FIELD_STEPS.length}:{" "}
            {stepMeta.heading}. Complete each slide to unlock your personal
            dashboard.
          </CardDescription>
        </div>

        <nav aria-label="Account details steps" className="space-y-2.5">
          <ol className="grid grid-cols-3 gap-2">
            {ACCOUNT_RECOVERY_FIELD_STEPS.map((entry) => {
              const complete = entry.id < step;
              const current = entry.id === step;
              return (
                <li key={entry.id} className="min-w-0">
                  <div
                    className={cn(
                      "account-recovery-step px-2 py-2 text-center",
                      current && "is-current",
                      complete && "is-complete",
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Step {entry.id}
                    </p>
                    <p className="truncate text-xs font-semibold">{entry.title}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="account-recovery-progress" aria-hidden>
            <div
              style={{
                width: `${(step / ACCOUNT_RECOVERY_FIELD_STEPS.length) * 100}%`,
              }}
            />
          </div>
        </nav>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={onContinue} className="flex flex-col gap-6">
          <div className="space-y-1">
            <h2 className="account-recovery-heading text-lg font-bold tracking-tight">
              {stepMeta.heading}
            </h2>
          </div>

          {error ? (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          ) : null}

          <AccountRecoveryFields
            idPrefix="onboarding"
            value={profile}
            onChange={setProfile}
            disabled={busy}
            step={step}
          />

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={busy || step <= 1}
              onClick={onBack}
              className="account-recovery-back h-10 w-full sm:w-auto"
            >
              Back
            </Button>
            <Button type="submit" disabled={busy} className="account-recovery-continue h-10 w-full sm:w-auto sm:min-w-40">
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : isLastStep ? (
                "Save and continue"
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
