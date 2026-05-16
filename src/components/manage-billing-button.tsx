"use client";

import { useTransition } from "react";
import { toast } from "sonner";
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

  function handleClick() {
    startTransition(async () => {
      try {
        const { url } = await createBillingPortalSessionAction();
        window.location.href = url;
      } catch (e) {
        toast.error("Could not open billing portal", {
          description:
            e instanceof Error ? e.message : "Please try again in a moment.",
        });
      }
    });
  }

  return (
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
  );
}
