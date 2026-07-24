/** Saved Account Details mailing address shaped for Stripe Checkout billing prefills. */
export type CheckoutSavedMailingAddress = {
  name: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
  };
  displayLines: string;
};
