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
import { toggleAdminRoleAction } from "@/actions/admin";
import { AdminUserIdentityBlock } from "@/components/admin-user-identity-block";

interface ToggleAdminRoleButtonProps {
  targetUserId: string;
  targetUserName: string;
  targetUserEmail: string | null;
  /** Target has co-admin role (`admin`), not platform owner. */
  isCoAdmin: boolean;
  targetIsSuperadmin: boolean;
  isSelf: boolean;
  callerIsSuperadmin: boolean;
}

export function ToggleAdminRoleButton({
  targetUserId,
  targetUserName,
  targetUserEmail,
  isCoAdmin,
  targetIsSuperadmin,
  isSelf,
  callerIsSuperadmin,
}: ToggleAdminRoleButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isSelf || targetIsSuperadmin || !callerIsSuperadmin) return null;

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await toggleAdminRoleAction({
        targetUserId,
        targetUserName,
        grant: !isCoAdmin,
      });
    });
  }

  return (
    <>
      <Button
        variant={isCoAdmin ? "destructive" : "outline"}
        size="xs"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? "…" : isCoAdmin ? "Revoke co-admin" : "Grant co-admin"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCoAdmin ? "Revoke co-admin role?" : "Grant co-admin role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCoAdmin
                ? "This will remove co-admin privileges from the following user. Complimentary Pro (if any) returns to how it was before they became co-admin; paid Pro from billing and its expiration are unchanged. The change is recorded in the Privilege Audit Log."
                : "This will grant co-admin privileges to the following user. They will be able to access the admin dashboard and manage users, but cannot grant or revoke co-admins or ban other co-admins. The change is recorded in the Privilege Audit Log."}
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
                isCoAdmin
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {isCoAdmin ? "Revoke co-admin" : "Grant co-admin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
