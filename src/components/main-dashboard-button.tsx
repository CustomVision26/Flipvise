"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setTeamContextCookieAction } from "@/actions/teams";

interface MainDashboardButtonProps {
  /** Team workspace to activate in the dropdown on the dashboard. Null clears the context (personal). */
  teamId: number | null;
  /** Pre-built href — `/dashboard?team=…` for team workspaces, or `/dashboard` for personal. */
  href: string;
}

/**
 * Navigates to the main dashboard and syncs the team-context cookie so the
 * workspace-switcher dropdown in the header correctly reflects the workspace
 * that was being managed on the team-admin page.
 */
export function MainDashboardButton({ teamId, href }: MainDashboardButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await setTeamContextCookieAction(teamId);
      router.push(href);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={pending}
    >
      ← Main Team Dashboard
    </Button>
  );
}
