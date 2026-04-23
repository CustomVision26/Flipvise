"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function TeamInviteAcceptedBanner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const show = sp.get("team_invite") === "accepted";

  function dismiss() {
    const next = new URLSearchParams(sp.toString());
    next.delete("team_invite");
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }

  if (!show) return null;

  return (
    <Alert className="border-primary/40 bg-primary/5">
      <AlertTitle>Team invitation accepted</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2 justify-between">
        <span>
          You have joined the team. Use the workspace switcher in the header to open the team
          workspace when you are ready.
        </span>
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={dismiss}>
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  );
}
