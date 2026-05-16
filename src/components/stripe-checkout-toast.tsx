"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import { syncBillingAfterCheckoutAction } from "@/actions/billing-page";

export const BILLING_SYNCED_EVENT = "flipvise:billing-synced";

/**
 * One-shot toasts after Stripe Checkout redirect (`?checkout=success` | `?checkout=canceled`).
 * On success, syncs billing from Stripe API when webhooks did not reach the app (local dev).
 */
export function StripeCheckoutToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const checkout = searchParams.get("checkout")?.trim();
    if (checkout !== "success" && checkout !== "canceled") return;

    handled.current = true;

    const next = new URL(window.location.href);
    next.searchParams.delete("checkout");
    const qs = next.searchParams.toString();
    router.replace(`${next.pathname}${qs ? `?${qs}` : ""}`, { scroll: false });

    if (checkout === "canceled") {
      toast.info("Checkout canceled", {
        description: "No charge was made. You can choose a plan again anytime.",
      });
      return;
    }

    void (async () => {
      try {
        const result = await syncBillingAfterCheckoutAction();
        await user?.reload?.();

        if (result.synced && result.planLabel) {
          toast.success("Subscription active", {
            description: `Your plan is now ${result.planLabel}.`,
            duration: 10_000,
          });
        } else {
          toast.success("Payment received", {
            description:
              "Stripe recorded your payment. If Billing still shows an old plan, run `stripe listen` locally or wait a moment and refresh.",
            duration: 12_000,
          });
        }

        window.dispatchEvent(new CustomEvent(BILLING_SYNCED_EVENT));
        router.refresh();
      } catch (err) {
        console.error("[StripeCheckoutToast] sync:", err);
        toast.warning("Payment received", {
          description:
            "We could not refresh your plan automatically. Open Billing again or ensure Stripe webhooks are configured.",
          duration: 12_000,
        });
      }
    })();
  }, [searchParams, router, user]);

  return null;
}
