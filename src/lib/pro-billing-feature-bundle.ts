/**
 * Pro capabilities in Clerk are expressed as a bundle of `feature` entitlements
 * (see `BILLING_IMPLEMENTATION.md`). Team-tier plans should attach the same
 * feature keys so subscribers get personal-workspace Pro parity.
 */
export function proBillingFeatureBundleSatisfied(
  has: ((a: { plan: string } | { feature: string }) => boolean | undefined) | undefined,
): boolean {
  if (!has) return false;
  return (
    Boolean(has({ feature: "unlimited_decks" })) &&
    Boolean(has({ feature: "ai_flashcard_generation" })) &&
    Boolean(has({ feature: "75_cards_per_deck" })) &&
    Boolean(has({ feature: "priority_support" })) &&
    Boolean(has({ feature: "12_interface_colors" }))
  );
}
