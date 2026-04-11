"use client";

import { useState, useTransition } from "react";
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
import { toggleAdminGrantAction } from "@/actions/admin";
import { AdminUserIdentityBlock } from "@/components/admin-user-identity-block";

interface GrantAccessButtonProps {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string | null;
  adminGranted: boolean;
  isPaidPro: boolean;
  isSelf: boolean;
}

export function GrantAccessButton({
  targetUserId,
  targetUserName,
  targetUserEmail,
  adminGranted,
  isPaidPro,
  isSelf,
}: GrantAccessButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Don't show a toggle for paying subscribers (they already have Pro via
  // Clerk Billing) or for the admin's own row.
  if (isSelf || isPaidPro) return null;

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await toggleAdminGrantAction({ targetUserId, grant: !adminGranted });
    });
  }

  return (
    <>
      <Button
        variant={adminGranted ? "destructive" : "outline"}
        size="xs"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? "…" : adminGranted ? "Revoke" : "Grant Pro"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {adminGranted ? "Revoke complimentary Pro?" : "Grant complimentary Pro?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {adminGranted
                ? "This will remove admin-granted Pro access for the following user. They will fall back to their billing plan (e.g. Free) unless they subscribe."
                : "This will grant Pro access (via admin grant) to the following user. Confirm you are targeting the correct account."}
            </AlertDialogDescription>
            <AdminUserIdentityBlock
              name={targetUserName}
              email={targetUserEmail}
              userId={targetUserId}
            />
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={
                adminGranted
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {adminGranted ? "Revoke Pro" : "Grant Pro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
