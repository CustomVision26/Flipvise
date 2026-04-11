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
  isAdmin: boolean;
  isSelf: boolean;
}

export function ToggleAdminRoleButton({
  targetUserId,
  targetUserName,
  targetUserEmail,
  isAdmin,
  isSelf,
}: ToggleAdminRoleButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isSelf) return null;

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      await toggleAdminRoleAction({
        targetUserId,
        targetUserName,
        grant: !isAdmin,
      });
    });
  }

  return (
    <>
      <Button
        variant={isAdmin ? "destructive" : "outline"}
        size="xs"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        {isPending ? "…" : isAdmin ? "Revoke Admin" : "Grant Admin"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isAdmin ? "Revoke admin role?" : "Grant admin role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin
                ? "This will remove admin privileges from the following user. Complimentary Pro (if any) returns to how it was before they became admin; paid Pro from billing and its expiration are unchanged. The change is recorded in the Privilege Audit Log."
                : "This will grant admin privileges to the following user. They will be able to access admin tools. The change is recorded in the Privilege Audit Log."}
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
                isAdmin
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
            >
              {isAdmin ? "Revoke Admin" : "Grant Admin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
