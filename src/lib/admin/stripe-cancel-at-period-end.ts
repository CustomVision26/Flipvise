import { stripe } from "@/lib/stripe";

export type StripeSubscriptionRenewalFlags = {
  cancelAtPeriodEnd: boolean;
  currentPeriodEndIso: string | null;
};

/**
 * Batch-read Stripe renewal flags for subscription ids (admin tables).
 * Missing / deleted subs are omitted from the map.
 */
export async function fetchStripeRenewalFlagsBySubscriptionId(
  subscriptionIds: string[],
  concurrency = 8,
): Promise<Map<string, StripeSubscriptionRenewalFlags>> {
  const unique = [
    ...new Set(
      subscriptionIds.map((id) => id.trim()).filter((id) => id.startsWith("sub_")),
    ),
  ];
  const out = new Map<string, StripeSubscriptionRenewalFlags>();
  if (unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (id) => {
        const sub = await stripe.subscriptions.retrieve(id, {
          expand: ["items.data"],
        });
        const item = sub.items.data[0] as
          | { current_period_end?: number }
          | undefined;
        const periodEndUnix =
          typeof item?.current_period_end === "number"
            ? item.current_period_end
            : typeof (sub as { current_period_end?: number }).current_period_end ===
                "number"
              ? (sub as { current_period_end: number }).current_period_end
              : null;
        return {
          id,
          cancelAtPeriodEnd: sub.cancel_at_period_end === true,
          currentPeriodEndIso:
            periodEndUnix != null
              ? new Date(periodEndUnix * 1000).toISOString()
              : null,
        };
      }),
    );
    for (const result of settled) {
      if (result.status === "fulfilled") {
        out.set(result.value.id, {
          cancelAtPeriodEnd: result.value.cancelAtPeriodEnd,
          currentPeriodEndIso: result.value.currentPeriodEndIso,
        });
      }
    }
  }

  return out;
}
