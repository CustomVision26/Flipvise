"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { syncBillingAfterCheckoutAction } from "@/actions/billing-page";
import { finalizePlanChangePaymentAction } from "@/actions/plan-change-checkout";
import { showSubscriptionSuccessToast } from "@/lib/subscription-success-toast";

function resolveCheckoutRedirectKind(
  searchParams: URLSearchParams,
): "success" | "canceled" | "plan_change" | null {
  const setupIntentId = searchParams.get("setup_intent")?.trim() ?? "";
  if (setupIntentId.startsWith("seti_")) {
    return "plan_change";
  }

  const checkoutValues = searchParams.getAll("checkout");
  if (checkoutValues.includes("plan_change")) return "plan_change";
  if (checkoutValues.includes("canceled")) return "canceled";
  if (checkoutValues.includes("success")) return "success";

  const checkout = searchParams.get("checkout")?.trim();
  if (
    checkout === "success" ||
    checkout === "canceled" ||
    checkout === "plan_change"
  ) {
    return checkout;
  }

  return null;
}

export const BILLING_SYNCED_EVENT = "flipvise:billing-synced";

const CHECKOUT_SYNC_RETRY_DELAYS_MS = [0, 1_500, 3_500, 6_000] as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function reloadClerkUserSession() {
  if (typeof window === "undefined") return;
  const clerk = (
    window as Window & { Clerk?: { user?: { reload?: () => Promise<unknown> } } }
  ).Clerk;
  await clerk?.user?.reload?.();
}

async function waitForClerkUserId(maxMs = 8_000): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const clerk = (
      window as Window & {
        Clerk?: { user?: { id?: string | null; reload?: () => Promise<unknown> } };
      }
    ).Clerk;
    if (clerk?.user?.id) return true;
    try {
      await clerk?.user?.reload?.();
    } catch {
      // Clerk may still be booting in the WebView.
    }
    if (clerk?.user?.id) return true;
    await sleep(400);
  }
  return Boolean(
    (
      window as Window & { Clerk?: { user?: { id?: string | null } } }
    ).Clerk?.user?.id,
  );
}

type CheckoutSyncResult = Awaited<ReturnType<typeof syncBillingAfterCheckoutAction>>;

async function syncBillingAfterCheckoutWithRetry(input: {
  checkoutSessionId: string;
}): Promise<CheckoutSyncResult> {
  let last: CheckoutSyncResult = {
    synced: false,
    planSlug: null,
    planLabel: null,
    receiptUrl: null,
    receiptIsProration: false,
  };

  for (const delayMs of CHECKOUT_SYNC_RETRY_DELAYS_MS) {
    if (delayMs > 0) await sleep(delayMs);
    await waitForClerkUserId(delayMs === 0 ? 4_000 : 2_000);
    last = await syncBillingAfterCheckoutAction({
      ...(input.checkoutSessionId ? { checkoutSessionId: input.checkoutSessionId } : {}),
    });
    if (last.synced && last.planLabel) return last;
  }

  return last;
}

/**
 * One-shot toasts after Stripe Checkout redirect (`?checkout=success` | `?checkout=canceled`).
 * On success, syncs billing from Stripe when webhooks did not reach the app (local dev / lag).
 */
export function StripeCheckoutToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const checkout = resolveCheckoutRedirectKind(searchParams);
    if (!checkout) {
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
          await waitForClerkUserId();
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

        const result = await syncBillingAfterCheckoutWithRetry({
          checkoutSessionId,
        });
        await reloadClerkUserSession();

        if (result.synced && result.planLabel) {
          showSubscriptionSuccessToast({
            planLabel: result.planLabel,
            receiptUrl: result.receiptUrl,
            isProration: result.receiptIsProration,
          });
        } else {
          toast.warning("Payment received", {
            description:
              "Your payment went through, but your plan is still syncing. Pull to refresh, or open your profile → Billing to confirm.",
            duration: 14_000,
            action: {
              label: "Refresh",
              onClick: () => {
                window.location.reload();
              },
            },
          });
        }

        window.dispatchEvent(new CustomEvent(BILLING_SYNCED_EVENT));
        router.refresh();
      } catch (err) {
        console.error("[StripeCheckoutToast] sync:", err);
        toast.warning("Payment received", {
          description:
            "Your payment was received, but we could not update your plan automatically. Please open your profile → Billing to verify your subscription, or contact support if your plan does not update shortly.",
          duration: 14_000,
          action: {
            label: "Refresh",
            onClick: () => {
              window.location.reload();
            },
          },
        });
        router.refresh();
      }
    })();
  }, [searchParams, router]);

  return null;
}
