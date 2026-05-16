"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { toggleUserBanAction } from "@/actions/admin";
import { AdminUserIdentityBlock } from "@/components/admin-user-identity-block";
import { Ban, ShieldCheck } from "lucide-react";

interface BanUserButtonProps {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string | null;
  isBanned: boolean;
  isSelf: boolean;
  callerIsSuperadmin: boolean;
  targetIsSuperadmin: boolean;
  targetIsCoAdmin: boolean;
}

export function BanUserButton({
  targetUserId,
  targetUserName,
  targetUserEmail,
  isBanned,
  isSelf,
  callerIsSuperadmin,
  targetIsSuperadmin,
  targetIsCoAdmin,
}: BanUserButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isSelf || targetIsSuperadmin) return null;
  if (targetIsCoAdmin && !callerIsSuperadmin) return null;

  const emailNotice = targetUserEmail
    ? ` A Loops notification email will be sent to ${targetUserEmail}.`
    : " This user has no email on file — no notification email will be sent.";

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      try {
        const result = await toggleUserBanAction({ targetUserId, ban: !isBanned });
        const actionLabel = isBanned ? "unbanned" : "banned";

        if (result.email.sent) {
          toast.success(`User ${actionLabel}`, {
            description: `Notification email sent to ${targetUserEmail}.`,
          });
        } else {
          toast.warning(`User ${actionLabel}`, {
            description: result.email.reason,
          });
        }
      } catch (err) {
        toast.error("Ban action failed", {
          description:
            err instanceof Error ? err.message : "Please try again.",
        });
      }
    });
  }

  return (
    <>
      <Button
        variant={isBanned ? "outline" : "destructive"}
        size="xs"
        disabled={isPending}
        onClick={() => setOpen(true)}
      >
        {isBanned ? (
          <>
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            {isPending ? "…" : "Unban"}
          </>
        ) : (
          <>
            <Ban className="h-3.5 w-3.5 mr-1" />
            {isPending ? "…" : "Ban"}
          </>
        )}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          {isBanned ? (
            <AlertDialogHeader>
              <AlertDialogTitle>Unban user?</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore full access to the application. They will be able to sign in
                again immediately.{emailNotice}
              </AlertDialogDescription>
              <AdminUserIdentityBlock
                name={targetUserName}
                email={targetUserEmail}
                userId={targetUserId}
              />
            </AlertDialogHeader>
          ) : (
            <AlertDialogHeader>
              <AlertDialogTitle>Ban user?</AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately revoke all active sessions and prevent them from signing in.
                Their account and data are preserved — this action can be undone by clicking
                Unban.{emailNotice}
              </AlertDialogDescription>
              <AdminUserIdentityBlock
                name={targetUserName}
                email={targetUserEmail}
                userId={targetUserId}
              />
            </AlertDialogHeader>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                isBanned
                  ? undefined
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {isBanned ? "Unban User" : "Ban User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
