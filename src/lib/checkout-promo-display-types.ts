/** Client-safe promo summary for on-site checkout (no server imports). */
export type CheckoutPromoDisplay = {
  kind: "general" | "affiliate";
  code: string;
  percentOff: number | null;
  /** e.g. `General Discount 5%` or `Affiliate 10% off` */
  kindLabel: string;
  /** e.g. `SUMMER26 (General Discount 5%)` */
  receiptLine: string | null;
};
