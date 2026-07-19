"use client";

import { useReverification, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteAccountAction,
  getAccountDeletionPreviewAction,
  type AccountDeletionPreview,
} from "@/actions/account";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TriangleAlert } from "lucide-react";

function formatRefund(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function isClerkDeleteAccountClick(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-flipvise-delete-dialog]")) return false;

  const profileRoot = target.closest(
    '.cl-userProfile-root, [class*="userProfile"], [class*="user-profile"]',
  );
  if (!profileRoot) return false;

  const dangerSection = target.closest(
    '.cl-profileSection__danger, [class*="profileSection__danger"]',
  );
  if (!dangerSection) return false;

  const clickable = target.closest("button, a, [role='button']") ?? target;
  const text = (clickable.textContent ?? "").trim();
  return /delete account/i.test(text);
}

/**
 * Intercepts Clerk Security → "Delete account" and shows Flipvise confirmation
 * (consequences, prorated refund for paid users, type DELETE, then credential
 * reverification via Clerk).
 */
export function AccountDeleteDialog() {
  const router = useRouter();
  const { isLoaded } = useUser();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [isPending, startTransition] = useTransition();
  const deleteWithReverification = useReverification(deleteAccountAction);

  const loadPreview = useCallback(() => {
    if (!isLoaded) return;
    setPreviewLoading(true);
    setPreviewError(null);
    getAccountDeletionPreviewAction()
      .then(setPreview)
      .catch(() => setPreviewError("Could not load billing details."))
      .finally(() => setPreviewLoading(false));
  }, [isLoaded]);

  useEffect(() => {
    function onCaptureClick(event: MouseEvent) {
      if (!isClerkDeleteAccountClick(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setConfirmPhrase("");
      setDialogOpen(true);
    }

    document.addEventListener("click", onCaptureClick, true);
    return () => document.removeEventListener("click", onCaptureClick, true);
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    loadPreview();
  }, [dialogOpen, loadPreview]);

  const confirmReady = confirmPhrase.trim() === "DELETE";

  function handleDelete() {
    if (!confirmReady) return;
    // Close so Clerk's credential prompt is not stacked under this dialog.
    setDialogOpen(false);
    startTransition(async () => {
      try {
        const result = await deleteWithReverification({
          confirmPhrase: "DELETE",
        });
        if (result.refundCents > 0) {
          toast.success("Account deleted", {
            description: `A prorated refund of ${formatRefund(result.refundCents, result.currency)} will be issued to your original payment method (typically 5–10 business days).`,
          });
        } else {
          toast.success("Account deleted");
        }
        router.replace("/");
        router.refresh();
      } catch (err) {
        if (isReverificationCancelledError(err)) return;
        toast.error("Could not delete account", {
          description:
            err instanceof Error ? err.message : "Please try again or contact support.",
        });
      }
    });
  }

  return (
    <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogContent
        data-flipvise-delete-dialog
        className="sm:max-w-lg z-[200000]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-destructive shrink-0" aria-hidden />
            Delete your account permanently?
          </AlertDialogTitle>
          <div className="space-y-3 text-sm text-muted-foreground">
            <AlertDialogDescription>
              This action is immediate and irreversible. The following will happen:
            </AlertDialogDescription>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>
                All decks, cards, quiz history, team workspaces you own, and inbox
                data will be permanently deleted.
              </li>
              <li>
                If you are a member of someone else&apos;s team workspace, you will
                be removed from those workspaces.
              </li>
              <li>
                You will be signed out immediately and cannot recover this account.
              </li>
              {previewLoading ? (
                <li className="flex items-center gap-2 list-none -ml-5 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Checking subscription…
                </li>
              ) : preview?.hasPaidSubscription ? (
                <li>
                  Your <span className="text-foreground">{preview.planLabel}</span>{" "}
                  subscription will be canceled immediately.
                  {preview.refundCents > 0 ? (
                    <>
                      {" "}
                      A prorated refund of approximately{" "}
                      <span className="text-foreground font-medium">
                        {formatRefund(preview.refundCents, preview.currency)}
                      </span>{" "}
                      will be sent to your original payment method (typically 5–10
                      business days).
                    </>
                  ) : (
                    <> No refund applies for your current billing period.</>
                  )}
                </li>
              ) : (
                <li>Free accounts are not charged; no refund applies.</li>
              )}
            </ul>
            {previewError ? <p className="text-xs">{previewError}</p> : null}
          </div>
          <div className="space-y-2 pt-2" data-flipvise-delete-dialog>
            <Label htmlFor="delete-confirm" className="text-foreground">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Next you will be asked to re-enter your sign-in credentials before the
              account is deleted.
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter data-flipvise-delete-dialog>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!confirmReady || isPending || previewLoading}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting…" : "Yes, delete my account"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
