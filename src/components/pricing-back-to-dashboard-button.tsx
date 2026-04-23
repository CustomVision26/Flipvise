"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setTeamContextCookieAction } from "@/actions/teams";

interface PricingBackToDashboardButtonProps {
  href: string;
  children: React.ReactNode;
}

/**
 * Clears the team workspace cookie (same as choosing “Personal” in the header
 * switcher) before navigating to the personal dashboard URL.
 */
export function PricingBackToDashboardButton({
  href,
  children,
}: PricingBackToDashboardButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await setTeamContextCookieAction(null);
      router.push(href);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2"
      disabled={pending}
      onClick={() => void handleClick()}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Button>
  );
}
