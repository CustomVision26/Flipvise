import { toast } from "sonner";

export function showSubscriptionSuccessToast(opts: {
  planLabel: string;
  receiptUrl?: string | null;
  isProration?: boolean;
  title?: string;
  /** Add-on checkout vs base plan / plan change. */
  kind?: "plan" | "addon" | "plan_change";
}): void {
  const receiptLabel = opts.isProration
    ? "View proration receipt"
    : "View billing receipt";

  const kind = opts.kind ?? (opts.isProration ? "plan_change" : "plan");
  const title =
    opts.title ??
    (kind === "addon"
      ? "Add-on unlocked"
      : kind === "plan_change"
        ? "Plan updated"
        : "Subscription active");

  const description =
    kind === "addon"
      ? `${opts.planLabel} is now active on your account. A confirmation was sent to your inbox.`
      : kind === "plan_change" || opts.isProration
        ? `Your plan is now ${opts.planLabel}. Stripe issued a proration invoice for the plan change. A confirmation was sent to your inbox.`
        : `Your plan is now ${opts.planLabel}. A confirmation was sent to your inbox.`;

  toast.success(title, {
    description,
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
