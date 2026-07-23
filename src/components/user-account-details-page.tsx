"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReverification, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { Loader2, Pencil, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { unlockAccountDetailsEditAction } from "@/actions/account-details-edit";
import {
  getAccountRecoveryProfileForEditAction,
  saveAccountRecoveryProfileAction,
} from "@/actions/account-recovery-profile";
import { AccountRecoveryFields } from "@/components/account-recovery-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  emptyAccountRecoveryFieldsValue,
  parseAccountRecoveryFieldsValue,
  type AccountRecoveryFieldsValue,
} from "@/lib/account-recovery-form-helpers";
import {
  ACCOUNT_TYPE_LABELS,
  SECURITY_QUESTION_LABELS,
  formatMailingAddress,
  type AccountType,
  type SecurityQuestionId,
} from "@/lib/account-recovery-profile";
import { Separator } from "@/components/ui/separator";

function maskWithAsterisks(value: string, min = 8, max = 24): string {
  const length = Math.max(min, Math.min(value.trim().length || min, max));
  return "*".repeat(length);
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border/50 py-3 last:border-b-0 sm:grid-cols-[9.5rem_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-foreground">{children}</dd>
    </div>
  );
}

function AccountDetailsSummary({
  profile,
}: {
  profile: AccountRecoveryFieldsValue;
}) {
  const typeLabel =
    profile.accountType && profile.accountType in ACCOUNT_TYPE_LABELS
      ? ACCOUNT_TYPE_LABELS[profile.accountType as AccountType]
      : null;

  const questions = profile.securityQuestions.filter(
    (slot) => slot.questionId && slot.answer.trim(),
  );

  return (
    <div className="rounded-md border border-border/70 bg-muted/15 px-4 py-1">
      <p className="border-b border-border/50 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Current details
      </p>
      <dl>
        <SummaryRow label="Phone number">
          <span className="font-medium">
            {profile.phoneNumber.trim() || "—"}
          </span>
        </SummaryRow>
        <SummaryRow label="Mailing address">
          <span className="whitespace-pre-wrap font-medium">
            {formatMailingAddress(profile.mailingAddress) || "—"}
          </span>
        </SummaryRow>
        <SummaryRow label="Type / status">
          <span className="font-medium">{typeLabel ?? "—"}</span>
        </SummaryRow>
        {profile.organizationName.trim() ? (
          <SummaryRow label="Organization">
            <span className="break-words font-medium">
              {profile.organizationName.trim()}
            </span>
          </SummaryRow>
        ) : null}
        <SummaryRow label="Security Q&A">
          {questions.length > 0 ? (
            <ul className="space-y-3" aria-label="Security questions hidden">
              {questions.map((slot) => {
                const questionLabel =
                  SECURITY_QUESTION_LABELS[
                    slot.questionId as SecurityQuestionId
                  ] ?? slot.questionId;
                return (
                  <li key={slot.questionId}>
                    <p className="font-medium leading-snug tracking-wide">
                      {maskWithAsterisks(questionLabel, 12, 32)}
                    </p>
                    <p className="mt-0.5 break-words tracking-wide text-muted-foreground">
                      {maskWithAsterisks(slot.answer, 8, 24)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            "—"
          )}
        </SummaryRow>
      </dl>
    </div>
  );
}

export function UserAccountDetailsPage() {
  const { user, isLoaded } = useUser();
  const unlockEditWithReverification = useReverification(
    unlockAccountDetailsEditAction,
  );
  const [profile, setProfile] = useState<AccountRecoveryFieldsValue>(
    emptyAccountRecoveryFieldsValue,
  );
  const [draft, setDraft] = useState<AccountRecoveryFieldsValue>(
    emptyAccountRecoveryFieldsValue,
  );
  const [editing, setEditing] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [unlockingEdit, setUnlockingEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfile(true);
    void getAccountRecoveryProfileForEditAction()
      .then((next) => {
        if (!cancelled) {
          setProfile(next);
          setDraft(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          const empty = emptyAccountRecoveryFieldsValue();
          setProfile(empty);
          setDraft(empty);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function startEditing() {
    if (unlockingEdit || busy) return;
    setUnlockingEdit(true);
    setError(null);
    try {
      const result = await unlockEditWithReverification();
      if (!result || !("ok" in result) || !result.ok) {
        return;
      }
      const fresh = await getAccountRecoveryProfileForEditAction();
      setProfile(fresh);
      setDraft(fresh);
      setEditing(true);
    } catch (err) {
      if (isReverificationCancelledError(err)) {
        return;
      }
      toast.error("Could not unlock editing", {
        description:
          err instanceof Error
            ? err.message
            : "Verify your login and try again.",
      });
    } finally {
      setUnlockingEdit(false);
    }
  }

  function cancelEditing() {
    setDraft(profile);
    setError(null);
    setEditing(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !user) return;

    const parsed = await parseAccountRecoveryFieldsValue(draft);
    if (!parsed.success) {
      setError(parsed.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await saveAccountRecoveryProfileAction(parsed.data);
      await user.reload();
      const saved = await getAccountRecoveryProfileForEditAction();
      setProfile(saved);
      setDraft(saved);
      setEditing(false);
      toast.success("Account details saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't save your account details. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 px-1 pb-4">
      <Card size="sm" className="border-border/70 shadow-none">
        <CardHeader className="space-y-1.5 border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold tracking-tight">
            Contact &amp; verification details
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Phone number, mailing address, account type, and security questions
            are used to verify your identity if you lose access. Security Q&amp;A
            stays hidden until you verify your login to edit.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          {!isLoaded || loadingProfile ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading…
            </p>
          ) : editing ? (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              {error ? (
                <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </p>
              ) : null}

              <AccountRecoveryFields
                idPrefix="account-settings"
                value={draft}
                onChange={setDraft}
                disabled={busy}
                nestedInModal
              />

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  disabled={busy || !isLoaded || loadingProfile}
                  className="h-9 w-full sm:w-auto"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={cancelEditing}
                  className="h-9 w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              <AccountDetailsSummary profile={profile} />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void startEditing()}
                  disabled={unlockingEdit}
                  className="h-9"
                >
                  {unlockingEdit ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      Verifying…
                    </>
                  ) : (
                    <>
                      <Pencil className="size-3.5" aria-hidden />
                      Edit details
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
