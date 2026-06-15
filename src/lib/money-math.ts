/** Round to two decimal places in major currency units (USD dollars, etc.). */
export function roundMajor(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format Stripe minor units (cents) for display — safe in client components. */
export function formatCentsMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
