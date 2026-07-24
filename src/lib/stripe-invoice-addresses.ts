import { createClerkClient } from "@clerk/backend";
import type Stripe from "stripe";
import { countryCodeFromName } from "@/data/world-countries";
import {
  formatMailingAddress,
  isMailingAddressComplete,
  parseMailingAddressFromPublicMetadata,
  type MailingAddressFields,
} from "@/lib/account-recovery-profile";
import { stripe } from "@/lib/stripe";
import type { CheckoutSavedMailingAddress } from "@/lib/checkout-saved-mailing-address";
import {
  getActiveStripeSubscription,
  getManageableStripeSubscription,
} from "@/db/queries/stripe-subscriptions";

export type { CheckoutSavedMailingAddress };

/**
 * Expected seller name on Stripe invoice PDFs.
 * Platform account business details cannot be updated via API (`accounts.update`
 * is Connect-only). Set in Stripe Dashboard → Settings → Business details:
 * business name "Flipvise Studio LLC", support/business address, and phone.
 */
export const STRIPE_INVOICE_SELLER_BUSINESS_NAME = "Flipvise Studio LLC";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

export type StripePostalAddress = {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;
};

/** Convert Flipvise mailing address fields to a Stripe Address object. */
export function mailingAddressToStripeAddress(
  address: MailingAddressFields,
): StripePostalAddress | null {
  if (!isMailingAddressComplete(address)) return null;
  const country = countryCodeFromName(address.country);
  if (!country) return null;

  const payload: StripePostalAddress = {
    line1: address.streetAddress.trim(),
    city: address.city.trim(),
    country,
  };
  const state = address.stateProvince.trim();
  if (state) payload.state = state;
  const postal = address.postalCode.trim();
  if (postal) payload.postal_code = postal;
  return payload;
}

async function loadClerkInvoiceProfile(userId: string): Promise<{
  name: string | null;
  email: string | null;
  phone: string | null;
  address: StripePostalAddress | null;
  mailing: MailingAddressFields | null;
} | null> {
  try {
    const user = await clerkClient.users.getUser(userId);
    const publicMeta = user.publicMetadata as Record<string, unknown>;
    const mailing = parseMailingAddressFromPublicMetadata(publicMeta);
    const phone =
      typeof publicMeta.recoveryPhone === "string"
        ? publicMeta.recoveryPhone.trim()
        : "";
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.username ||
      null;
    const email =
      user.primaryEmailAddress?.emailAddress?.toLowerCase() ??
      user.emailAddresses[0]?.emailAddress?.toLowerCase() ??
      null;
    const completeMailing = isMailingAddressComplete(mailing) ? mailing : null;

    return {
      name,
      email,
      phone: phone || null,
      address: mailingAddressToStripeAddress(mailing),
      mailing: completeMailing,
    };
  } catch (error) {
    console.error("[stripe-invoice-addresses] loadClerkInvoiceProfile:", error);
    return null;
  }
}

/**
 * Returns the signed-in user's complete Flipvise mailing address (Account Details)
 * in Stripe Checkout contact shape, or null when incomplete / unavailable.
 */
export async function getSavedMailingAddressForCheckout(
  clerkUserId: string,
): Promise<CheckoutSavedMailingAddress | null> {
  const profile = await loadClerkInvoiceProfile(clerkUserId);
  if (!profile?.address || !profile.mailing) return null;

  return {
    name: profile.name?.trim() || "",
    address: profile.address,
    displayLines: formatMailingAddress(profile.mailing),
  };
}

/**
 * Set Stripe Customer Bill-to from the user's Account details mailing address
 * (not the card billing address collected at Checkout).
 */
export async function syncStripeCustomerBillToFromClerkUser(
  customerId: string,
  clerkUserId: string,
): Promise<void> {
  const profile = await loadClerkInvoiceProfile(clerkUserId);
  if (!profile?.address) return;

  const update: Stripe.CustomerUpdateParams = {
    address: profile.address,
  };
  if (profile.name) update.name = profile.name;
  if (profile.email) update.email = profile.email;
  if (profile.phone) update.phone = profile.phone;
  // Keep shipping aligned so Invoice PDF fallbacks stay consistent.
  if (profile.name) {
    update.shipping = {
      name: profile.name,
      address: profile.address,
      ...(profile.phone ? { phone: profile.phone } : {}),
    };
  }

  await stripe.customers.update(customerId, update);
}

/** Best-effort: sync Bill-to for the user's known Stripe customer id. */
export async function syncStripeCustomerBillToForClerkUser(
  clerkUserId: string,
): Promise<void> {
  try {
    const sub =
      (await getManageableStripeSubscription(clerkUserId)) ??
      (await getActiveStripeSubscription(clerkUserId));
    if (!sub?.stripeCustomerId) return;
    await syncStripeCustomerBillToFromClerkUser(
      sub.stripeCustomerId,
      clerkUserId,
    );
  } catch (error) {
    console.error(
      "[stripe-invoice-addresses] syncStripeCustomerBillToForClerkUser:",
      error,
    );
  }
}
