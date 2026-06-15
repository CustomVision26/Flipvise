/** Lowercase alphanumeric slug from display name (for promo prefix like userA). */
export function slugifyAffiliatePromoBase(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 10);
  if (ascii.length === 0) return "aff";
  return ascii.charAt(0).toLowerCase() + ascii.slice(1);
}

/**
 * Combined promotion string: Stripe general coupon id + affiliate promotional code
 * (e.g. SummerLaunch + usera1276 → SummerLaunchusera1276).
 */
export function formatCombinedPromotionCode(
  stripeCouponId: string,
  promotionalCode: string,
): string {
  return `${stripeCouponId.trim()}${promotionalCode.trim().toLowerCase()}`;
}
