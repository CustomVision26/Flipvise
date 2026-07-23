"use client";

import { useState } from "react";
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
    <Card className="w-full max-w-lg border-border/70 shadow-sm">
      <CardHeader className="space-y-4 border-b border-border/60 pb-5">
        <div className="space-y-2">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Account information
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
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
                      "rounded-md border px-2 py-2 text-center",
                      current
                        ? "border-foreground/35 bg-muted/40"
                        : complete
                          ? "border-border/70 bg-muted/20"
                          : "border-border/50 bg-transparent",
                    )}
                  >
                    <p
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-[0.08em]",
                        current ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      Step {entry.id}
                    </p>
                    <p
                      className={cn(
                        "truncate text-xs font-medium",
                        current ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {entry.title}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div
            className="h-1 overflow-hidden rounded-full bg-muted"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-foreground/70 transition-all duration-300"
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
            <h2 className="text-base font-semibold tracking-tight">
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

          <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-5 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={busy || step <= 1}
              onClick={onBack}
              className="h-10 w-full sm:w-auto"
            >
              Back
            </Button>
            <Button type="submit" disabled={busy} className="h-10 w-full sm:w-auto sm:min-w-40">
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
