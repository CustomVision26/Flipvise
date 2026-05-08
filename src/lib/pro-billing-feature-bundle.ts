/**
 * Clerk Billing may expose paid personal access via plan ids (`pro`, `pro_plus`),
 * semantic features (`pro_plan_features`, `pro_plus_plan_features`), or the legacy
 * unlimited-style bundle (`unlimited_decks`, `75_cards_per_deck`, …).
 */
export function legacyUnlimitedStyleProBundleSatisfied(
  has:
    | ((a: { plan: string } | { feature: string }) => boolean | undefined)
    | undefined,
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

export function proBillingFeatureBundleSatisfied(
  has:
    | ((a: { plan: string } | { feature: string }) => boolean | undefined)
    | undefined,
): boolean {
  if (!has) return false;
  if (has({ plan: "pro" }) || has({ plan: "pro_plus" })) return true;
  return (
    Boolean(has({ feature: "pro_plan_features" })) ||
    Boolean(has({ feature: "pro_plus_plan_features" })) ||
    legacyUnlimitedStyleProBundleSatisfied(has)
  );
}
