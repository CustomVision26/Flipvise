"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { userResolveContactUsThreadAction } from "@/actions/contact-us";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContactUsThreadCloseButtonProps = {
  messageId: number;
  accessToken?: string;
  href?: string;
  label?: string;
  variant?: "outline" | "ghost";
  size?: "sm" | "default";
  className?: string;
  iconOnly?: boolean;
};

export function ContactUsThreadCloseButton({
  messageId,
  accessToken,
  href = "/contact",
  label = "Close conversation",
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: ContactUsThreadCloseButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    startTransition(async () => {
      try {
        await userResolveContactUsThreadAction({ messageId, token: accessToken });
        toast.success("Conversation closed");
      } catch {
        toast.error("Could not close the conversation. Returning to Contact Us.");
      }
      router.push(href);
    });
  }

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("size-8 shrink-0", className)}
        disabled={isPending}
        onClick={handleClose}
        aria-label={label}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <X className="size-4" aria-hidden />
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isPending}
      onClick={handleClose}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
