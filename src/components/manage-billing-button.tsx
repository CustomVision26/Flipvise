"use client";

import { useState, useTransition } from "react";
import { createBillingPortalSessionAction } from "@/actions/stripe";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

type ManageBillingButtonProps = {
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
  className?: string;
};

export function ManageBillingButton({
  label = "Manage subscription",
  variant = "outline",
  size = "default",
  className,
}: ManageBillingButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const { url } = await createBillingPortalSessionAction();
        window.location.href = url;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not open billing portal.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={isPending}
        onClick={handleClick}
        className={cn("gap-2", className)}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CreditCard className="size-4" />
        )}
        {isPending ? "Opening portal…" : label}
      </Button>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
