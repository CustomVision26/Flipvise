"use client";

import * as React from "react";
import { useSession } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTeamContextCookieAction } from "@/actions/teams";
import { cn } from "@/lib/utils";

interface MainDashboardButtonProps {
  /** Team workspace to activate in the dropdown when opening a `/dashboard` URL — prefer `null` for personal authoring. */
  teamId: number | null;
  /** Pre-built href — normally `/dashboard` for subscribers (personal dashboard). */
  href: string;
  /** Accessible label — defaults to `← Personal dashboard` when authoring lives on `/dashboard`. */
  label?: string;
  /** When true, shows a leading back arrow (e.g. return to Personal Dashboard). */
  leadingArrow?: boolean;
  /** When true, shows a trailing forward arrow icon (e.g. workspace dashboard link from team admin). */
  trailingArrow?: boolean;
  /** Visual weight — default `outline`. */
  variant?: "outline" | "secondary";
  className?: string;
}

/**
 * Navigates to the main dashboard and syncs the team-context cookie when `teamId` is set so the
 * workspace switcher stays consistent — team-tier subscribers authoring on Personal should pass `teamId=null`.
 */
export function MainDashboardButton({
  teamId,
  href,
  label = "← Personal dashboard",
  leadingArrow = false,
  trailingArrow = false,
  variant = "outline",
  className,
}: MainDashboardButtonProps) {
  const router = useRouter();
  const { session, isLoaded: sessionLoaded } = useSession();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    if (!sessionLoaded) return;
    setPending(true);
    try {
      try {
        await session?.getToken();
      } catch {
        /* allow action to run; recover below */
      }
      await setTeamContextCookieAction(teamId);
      router.push(href);
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        router.push("/");
        return;
      }
      throw err;
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={variant}
      size="sm"
      className={cn(className)}
      onClick={handleClick}
      disabled={pending || !sessionLoaded}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {leadingArrow ? (
          <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
        {label}
        {trailingArrow ? (
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : null}
      </span>
    </Button>
  );
}
