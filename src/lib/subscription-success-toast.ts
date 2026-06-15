import { toast } from "sonner";

export function showSubscriptionSuccessToast(opts: {
  planLabel: string;
  receiptUrl?: string | null;
  isProration?: boolean;
  title?: string;
}): void {
  const receiptLabel = opts.isProration
    ? "View proration receipt"
    : "View billing receipt";

  toast.success(opts.title ?? "Subscription active", {
    description: opts.isProration
      ? `Your plan is now ${opts.planLabel}. Stripe issued a proration invoice for the plan change.`
      : `Your plan is now ${opts.planLabel}.`,
    duration: 14_000,
    ...(opts.receiptUrl
      ? {
          action: {
            label: receiptLabel,
            onClick: () => {
              window.open(opts.receiptUrl!, "_blank", "noopener,noreferrer");
            },
          },
        }
      : {}),
  });
}
