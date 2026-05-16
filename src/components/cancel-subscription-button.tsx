"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelSubscriptionAtPeriodEndAction,
  createSubscriptionCancelPortalSessionAction,
  getCancelSubscriptionPreviewAction,
} from "@/actions/stripe";
import type { CancelSubscriptionPreview } from "@/lib/stripe-cancel-subscription";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

function formatPeriodEnd(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function renewalLabel(interval: CancelSubscriptionPreview["billingInterval"]) {
  if (interval === "year") return "next year’s renewal";
  if (interval === "month") return "next month’s renewal";
  return "your next renewal";
}

type CancelSubscriptionButtonProps = {
  variant?: "default" | "outline" | "ghost" | "secondary" | "destructive";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
  className?: string;
  /** When provided by the billing tab loader, avoids a separate server action on mount. */
  preview?: CancelSubscriptionPreview | null;
  onPreviewChange?: (preview: CancelSubscriptionPreview | null) => void;
};

export function CancelSubscriptionButton({
  variant = "outline",
  size = "sm",
  className,
  preview: previewProp = null,
  onPreviewChange,
}: CancelSubscriptionButtonProps) {
  const router = useRouter();
  const [previewLocal, setPreviewLocal] = useState<CancelSubscriptionPreview | null>(
    previewProp,
  );
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = previewProp ?? previewLocal;

  const loadPreview = useCallback(async () => {
    setPreviewError(null);
    try {
      const data = await getCancelSubscriptionPreviewAction();
      setPreviewLocal(data);
      onPreviewChange?.(data);
      return data;
    } catch (err) {
      setPreviewLocal(null);
      onPreviewChange?.(null);
      const message =
        err instanceof Error ? err.message : "Could not load subscription.";
      setPreviewError(message);
      return null;
    }
  }, [onPreviewChange]);

  function runCancel(previewData: CancelSubscriptionPreview) {
    startTransition(async () => {
      try {
        const portal = await createSubscriptionCancelPortalSessionAction();
        toast.success("Opening Stripe", {
          description:
            "Complete cancellation in Stripe to apply proration and stop future renewals.",
        });
        window.location.href = portal.url;
      } catch {
        try {
          const result = await cancelSubscriptionAtPeriodEndAction();
          toast.success("Subscription renewal canceled", {
            description: `Your ${previewData.planLabel} access continues until ${formatPeriodEnd(result.periodEnd)}. You will not be charged for ${renewalLabel(previewData.billingInterval)}.`,
          });
          router.refresh();
          const refreshed = await loadPreview();
          if (refreshed?.cancelAtPeriodEnd) {
            // parent re-renders from router.refresh
          }
        } catch (err) {
          toast.error("Could not cancel subscription", {
            description:
              err instanceof Error ? err.message : "Please try again.",
          });
        }
      }
    });
  }

  async function handleClick() {
    let activePreview = preview;
    if (!activePreview) {
      activePreview = await loadPreview();
    }
    if (!activePreview) {
      toast.error("Subscription unavailable", {
        description: previewError ?? "Try again in a moment.",
      });
      return;
    }

    if (activePreview.cancelAtPeriodEnd) {
      toast.info("Cancellation already scheduled", {
        description: `Your plan stays active until ${formatPeriodEnd(activePreview.periodEnd)}. No further renewals will be charged.`,
      });
      return;
    }

    const periodEndFormatted = formatPeriodEnd(activePreview.periodEnd);
    const renewal = renewalLabel(activePreview.billingInterval);

    toast.warning("Cancel subscription renewal?", {
      description: `Your ${activePreview.planLabel} plan will remain active until ${periodEndFormatted}. Stripe will stop ${renewal} and apply proration per your billing settings. You can finish cancellation in Stripe.`,
      duration: 60_000,
      action: {
        label: "Continue in Stripe",
        onClick: () => runCancel(activePreview),
      },
      cancel: {
        label: "Keep subscription",
        onClick: () => {},
      },
    });
  }

  if (previewError && !preview) {
    if (/no active paid subscription/i.test(previewError)) {
      return null;
    }
    return <p className="text-xs text-destructive">{previewError}</p>;
  }

  if (preview?.cancelAtPeriodEnd) {
    return (
      <p className="text-xs text-muted-foreground">
        Renewal canceled — access until{" "}
        <span className="text-foreground font-medium">
          {formatPeriodEnd(preview.periodEnd)}
        </span>
        .
      </p>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isPending}
      onClick={() => void handleClick()}
      className={className}
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Processing…
        </>
      ) : (
        "Cancel subscription"
      )}
    </Button>
  );
}
