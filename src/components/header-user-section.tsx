"use client";

import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
export function HeaderUserSection() {
  const { userId, has } = useAuth();
  const { user } = useUser();

  const isPaidPro = has?.({ plan: "pro" }) ?? false;
  const meta = user?.publicMetadata as
    | { adminGranted?: boolean; role?: string }
    | undefined;
  const adminGranted = meta?.adminGranted === true;
  const isAdmin = meta?.role === "admin";
  // Admins (assigned from Clerk Dashboard or the app) get Pro automatically.
  const isPro = isPaidPro || adminGranted || isAdmin;

  if (!userId) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Link
          href="/admin"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Admin
        </Link>
      )}
      <Badge
        variant={isPro ? "default" : "secondary"}
        className="text-xs font-semibold tracking-wide"
      >
        {isPro ? "Pro" : "Free"}
      </Badge>
      <UserButton />
    </div>
  );
}
