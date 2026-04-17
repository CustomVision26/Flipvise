"use client";

import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { SettingsMenu } from "@/components/settings-menu";
import { HelpCenter } from "@/components/help-center";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProUiThemeId } from "@/lib/pro-ui-theme";
import type { FreeUiThemeId } from "@/lib/free-ui-theme";

interface HeaderUserSectionProps {
  currentProTheme?: ProUiThemeId;
  currentFreeTheme?: FreeUiThemeId;
}

export function HeaderUserSection({ currentProTheme, currentFreeTheme }: HeaderUserSectionProps) {
  const { userId, has } = useAuth();
  const { user } = useUser();

  const isPaidPro = has?.({ plan: "pro" }) ?? false;
  const meta = user?.publicMetadata as
    | { adminGranted?: boolean; role?: string }
    | undefined;
  const adminGranted = meta?.adminGranted === true;
  const isAdmin = meta?.role === "admin";
  const isPro = isPaidPro || adminGranted || isAdmin;

  if (!userId) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {isAdmin && (
        <Link
          href="/admin"
          className={buttonVariants({ variant: "outline", size: "sm" }) + " text-xs h-8 px-2.5 sm:px-3"}
        >
          Admin
        </Link>
      )}
      <Link href="/pricing">
        <Badge
          variant={isPro ? "default" : "secondary"}
          className="text-[10px] sm:text-xs font-semibold tracking-wide px-1.5 sm:px-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {isPro ? "Pro" : "Free"}
        </Badge>
      </Link>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex items-center" />}>
          <UserButton />
        </TooltipTrigger>
        <TooltipContent side="bottom">Account</TooltipContent>
      </Tooltip>
      <SettingsMenu 
        currentProTheme={currentProTheme}
        currentFreeTheme={currentFreeTheme}
      />
      <HelpCenter />
    </div>
  );
}
