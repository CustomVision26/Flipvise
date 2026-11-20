"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Reloads inbox messages from the server without leaving the page. */
export function InboxRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="inbox-refresh mt-2 inline-flex gap-2 self-start"
      disabled={pending}
      aria-label="Refresh inbox"
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
    >
      <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
