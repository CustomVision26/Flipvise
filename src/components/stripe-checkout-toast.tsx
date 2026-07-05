"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { syncBillingAfterCheckoutAction } from "@/actions/billing-page";
import { finalizePlanChangePaymentAction } from "@/actions/plan-change-checkout";
import { showSubscriptionSuccessToast } from "@/lib/subscription-success-toast";

export const BILLING_SYNCED_EVENT = "flipvise:billing-synced";

async function reloadClerkUserSession() {
  if (typeof window === "undefined") return;
  const clerk = (
    window as Window & { Clerk?: { user?: { reload?: () => Promise<unknown> } } }
  ).Clerk;
  await clerk?.user?.reload?.();
}

/**
 * One-shot toasts after Stripe Checkout redirect (`?checkout=success` | `?checkout=canceled`).
 * On success, syncs billing from Stripe API when webhooks did not reach the app (local dev).
 */
export function StripeCheckoutToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const checkout = searchParams.get("checkout")?.trim();
    if (
      checkout !== "success" &&
      checkout !== "canceled" &&
      checkout !== "plan_change"
    ) {
      return;
    }

    handled.current = true;

    const checkoutSessionId = searchParams.get("session_id")?.trim() ?? "";
    const setupIntentId = searchParams.get("setup_intent")?.trim() ?? "";

    const next = new URL(window.location.href);
    next.searchParams.delete("checkout");
    next.searchParams.delete("session_id");
    next.searchParams.delete("setup_intent");
    next.searchParams.delete("setup_intent_client_secret");
    next.searchParams.delete("redirect_status");
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
        if (checkout === "plan_change") {
          const result = await finalizePlanChangePaymentAction({
            ...(setupIntentId ? { setupIntentId } : {}),
          });
          await reloadClerkUserSession();

          if (result.synced && result.planLabel) {
            showSubscriptionSuccessToast({
              title: "Plan updated",
              planLabel: result.planLabel,
              receiptUrl: result.receiptUrl,
              isProration: result.receiptIsProration,
            });
          } else {
            toast.success("Plan change recorded", {
              description:
                "Your subscription was updated. Open Billing if your plan has not refreshed yet.",
              duration: 12_000,
            });
          }

          window.dispatchEvent(new CustomEvent(BILLING_SYNCED_EVENT));
          router.refresh();
          return;
        }

        const result = await syncBillingAfterCheckoutAction({
          ...(checkoutSessionId ? { checkoutSessionId } : {}),
        });
        await reloadClerkUserSession();

        if (result.synced && result.planLabel) {
          showSubscriptionSuccessToast({
            planLabel: result.planLabel,
            receiptUrl: result.receiptUrl,
            isProration: result.receiptIsProration,
          });
        } else {
          toast.success("Payment received", {
            description:
              "Your payment was processed successfully. Your subscription may take a moment to appear—refresh this page or open Billing to confirm your new plan.",
            duration: 12_000,
          });
        }

        window.dispatchEvent(new CustomEvent(BILLING_SYNCED_EVENT));
        router.refresh();
      } catch (err) {
        console.error("[StripeCheckoutToast] sync:", err);
        toast.warning("Payment received", {
          description:
            "Your payment was received, but we could not update your plan automatically. Please open Billing to verify your subscription, or contact support if your plan does not update shortly.",
          duration: 12_000,
        });
      }
    })();
  }, [searchParams, router]);

  return null;
}
