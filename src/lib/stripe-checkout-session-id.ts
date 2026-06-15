/** Stripe Checkout Session ids (`cs_…` legacy, `sess_…` newer API shapes). */
export function isStripeCheckoutSessionId(
  id: string | null | undefined,
): boolean {
  const value = id?.trim() ?? "";
  return value.startsWith("cs_") || value.startsWith("sess_");
}

export function isStripeSetupIntentId(id: string | null | undefined): boolean {
  const value = id?.trim() ?? "";
  return value.startsWith("seti_");
}
