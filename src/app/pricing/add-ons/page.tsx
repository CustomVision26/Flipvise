import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  PricingAddonsCatalog,
  type PricingAddonCard,
} from "@/components/pricing-addons-catalog";
import {
  getAddonCatalogSettings,
  getUserAddonEntitlement,
  isPlanEligibleForAddon,
  listPublishedActiveAddonsForPricing,
} from "@/db/queries/addons";
import { getAccessContext, guestAccessContext } from "@/lib/access";
import { AI_ESSAY_ADDON_KEY } from "@/lib/addon-keys";
import { isAiEssayComingSoonForTeamMember } from "@/lib/essay-access";
import { isStripeAddonSubscription } from "@/lib/stripe-addon-metadata";
import { resolveAddonStripePriceLabels } from "@/lib/stripe-addon-price-display";
import { stripe } from "@/lib/stripe";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { toClientJson } from "@/lib/to-client-json";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

async function resolveStripeAddonRenewalState(
  stripeSubscriptionId: string | null | undefined,
): Promise<{
  canCancelRenewal: boolean;
  renewalCancelScheduled: boolean;
  accessUntilLabel: string | null;
}> {
  const subId = stripeSubscriptionId?.trim();
  if (!subId) {
    return {
      canCancelRenewal: false,
      renewalCancelScheduled: false,
      accessUntilLabel: null,
    };
  }

  try {
    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ["items.data"],
    });
    if (!isStripeAddonSubscription(sub)) {
      return {
        canCancelRenewal: false,
        renewalCancelScheduled: false,
        accessUntilLabel: null,
      };
    }

    const item = sub.items.data[0] as
      | (Stripe.SubscriptionItem & { current_period_end?: number })
      | undefined;
    const periodEndUnix =
      typeof item?.current_period_end === "number"
        ? item.current_period_end
        : (sub as Stripe.Subscription & { current_period_end?: number })
            .current_period_end;
    const accessUntilLabel =
      typeof periodEndUnix === "number"
        ? new Date(periodEndUnix * 1000).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
          })
        : null;

    const renewing =
      sub.status === "active" ||
      sub.status === "trialing" ||
      sub.status === "past_due";
    const renewalCancelScheduled = sub.cancel_at_period_end === true;

    return {
      canCancelRenewal: renewing && !renewalCancelScheduled,
      renewalCancelScheduled,
      accessUntilLabel,
    };
  } catch {
    return {
      canCancelRenewal: false,
      renewalCancelScheduled: false,
      accessUntilLabel: null,
    };
  }
}

export default async function PricingAddOnsPage() {
  const settings = await getAddonCatalogSettings();
  if (!settings.pricingCatalogVisible) {
    redirect("/pricing");
  }

  let access = guestAccessContext();
  try {
    access = await getAccessContext();
  } catch {
    access = guestAccessContext();
  }

  const published = await listPublishedActiveAddonsForPricing();
  const cards: PricingAddonCard[] = [];
  const essayComingSoon =
    access.userId != null
      ? await isAiEssayComingSoonForTeamMember(access.userId, access)
      : false;

  for (const row of published) {
    const entitledRow =
      access.userId != null
        ? await getUserAddonEntitlement(access.userId, row.key)
        : null;
    // Team-sourced AI Essay grants do not grant access (owner-only for now).
    const entitled =
      entitledRow?.status === "active" &&
      !(
        row.key === AI_ESSAY_ADDON_KEY && entitledRow.source === "team"
      );
    const eligible = isPlanEligibleForAddon(
      row.eligiblePlanIds,
      access.effectivePlanSlug,
    );
    const priceLabels = await resolveAddonStripePriceLabels(row.stripePriceEnvKey);
    const stripePriceConfigured = priceLabels.monthlyConfigured;
    const yearlyPriceConfigured = priceLabels.yearlyConfigured;
    const renewalState =
      entitled && entitledRow?.source === "stripe"
        ? await resolveStripeAddonRenewalState(entitledRow.stripeSubscriptionId)
        : {
            canCancelRenewal: false,
            renewalCancelScheduled: false,
            accessUntilLabel: null,
          };
    const memberEssayComingSoon =
      row.key === AI_ESSAY_ADDON_KEY && essayComingSoon && !entitled;

    cards.push({
      key: row.key,
      name: row.name,
      description: row.description,
      marketingBlurb: row.marketingBlurb,
      eligible,
      entitled,
      entitlementSource: entitled ? entitledRow?.source ?? null : null,
      canPurchase:
        !memberEssayComingSoon &&
        eligible &&
        !entitled &&
        stripePriceConfigured &&
        row.active,
      comingSoon: memberEssayComingSoon,
      stripePriceConfigured,
      yearlyPriceConfigured,
      monthlyPriceLabel: priceLabels.monthlyLabel,
      yearlyPriceLabel: priceLabels.yearlyLabel,
      yearlyMonthlyEquivalentLabel: priceLabels.yearlyMonthlyEquivalentLabel,
      canCancelRenewal: renewalState.canCancelRenewal,
      renewalCancelScheduled: renewalState.renewalCancelScheduled,
      accessUntilLabel: renewalState.accessUntilLabel,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-4">
        <Link
          href="/pricing"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "w-fit gap-2 text-muted-foreground",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to Pricing
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Add-on Catalog</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Optional features for eligible paid plans (monthly or yearly where
            configured). Add-ons bill separately from your plan — first charge is
            prorated to your plan’s renewal date, then renewals stay aligned but
            can be canceled independently. Team Admin or platform admin grants
            are also supported.
          </p>
        </div>
      </div>

      <PricingAddonsCatalog
        addons={toClientJson(cards)}
        signedIn={access.userId != null}
        effectivePlanSlug={access.effectivePlanSlug}
      />
    </div>
  );
}
