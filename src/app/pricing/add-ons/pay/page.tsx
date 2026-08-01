import { redirect } from "next/navigation";
import { auth } from "@/lib/clerk-auth";
import {
  PricingCheckoutPayment,
  type PricingCheckoutSummary,
} from "@/components/pricing-checkout-payment";
import { getAddonCatalogByKey } from "@/db/queries/addons";
import { getClerkUserFieldDisplayById } from "@/lib/clerk-user-display";
import { checkoutSessionAmountsMajor } from "@/lib/stripe-checkout-session-amounts";
import { stripe } from "@/lib/stripe";
import { isStripeCheckoutSessionId } from "@/lib/stripe-checkout-session-id";
import { getSavedMailingAddressForCheckout } from "@/lib/stripe-invoice-addresses";
import { toClientJson } from "@/lib/to-client-json";

export const dynamic = "force-dynamic";

interface AddonCheckoutPayPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function AddonCheckoutPayPage({
  searchParams,
}: AddonCheckoutPayPageProps) {
  const { session_id: sessionIdParam } = await searchParams;
  const sessionId = sessionIdParam?.trim() ?? "";

  const { userId } = await auth();
  if (!userId) redirect("/");

  if (!isStripeCheckoutSessionId(sessionId)) {
    redirect("/pricing/add-ons");
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["total_details.breakdown"],
    });
  } catch {
    redirect("/pricing/add-ons");
  }

  if (session.metadata?.clerkUserId !== userId) {
    redirect("/pricing/add-ons");
  }
  if (session.metadata?.type !== "addon") {
    redirect("/pricing/checkout/pay?session_id=" + encodeURIComponent(sessionId));
  }

  if (session.status === "complete") {
    redirect("/pricing/add-ons?addon_checkout=success");
  }

  if (!session.client_secret) {
    redirect("/pricing/add-ons");
  }

  const addonKey = session.metadata?.addonKey?.trim() ?? "";
  const catalog = addonKey ? await getAddonCatalogByKey(addonKey) : null;

  let customerEmail =
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    null;
  if (!customerEmail) {
    const { primaryEmail } = await getClerkUserFieldDisplayById(userId);
    customerEmail = primaryEmail?.trim().toLowerCase() ?? null;
  }

  const savedMailingAddress = await getSavedMailingAddressForCheckout(userId);
  const stripeAmounts = checkoutSessionAmountsMajor(session);
  const period =
    session.metadata?.period === "yearly" ? "yearly" : "monthly";
  const alignIso = session.metadata?.alignsWithBasePeriodEnd?.trim() || null;
  let billingNote: string | null = null;
  if (alignIso) {
    const alignDate = new Date(alignIso);
    if (!Number.isNaN(alignDate.getTime())) {
      const formatted = alignDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      billingNote = `Today’s charge is prorated through ${formatted}, aligned with your plan’s renewal date. After that, this add-on renews on its own (cancel anytime without affecting your plan).`;
    }
  }

  const summary: PricingCheckoutSummary = {
    planLabel: catalog?.name ?? "Add-on",
    period,
    customerEmail,
    campaignLabel: null,
    promo: null,
    isTrial: false,
    trialDays: null,
    monthlyRateAfterTrial: stripeAmounts?.subtotalMajor ?? null,
    stripeAmounts,
    billingNote,
  };

  return (
    <PricingCheckoutPayment
      clientSecret={session.client_secret}
      summary={toClientJson(summary)}
      backHref="/pricing/add-ons"
      savedMailingAddress={
        savedMailingAddress ? toClientJson(savedMailingAddress) : null
      }
    />
  );
}
