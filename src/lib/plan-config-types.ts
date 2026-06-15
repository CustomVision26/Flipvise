export type PlanDiscount = {
  active: boolean;
  type: "percentage" | "fixed";
  value: number;
  label: string;
  stripeCouponId: string;
};

/** Separate from the public “general” discount — combined Stripe coupon + affiliate code at checkout. */
export type PlanAffiliateDiscount = {
  active: boolean;
  value: number;
  label?: string;
};

export type PlanConfig = {
  id: string;
  name: string;
  monthlyPrice: number | null;
  yearlyMonthlyPrice: number | null;
  description: string;
  features: string[];
  highlighted?: boolean;
  discount?: PlanDiscount;
  affiliateDiscount?: PlanAffiliateDiscount;
  discontinueAt?: string | null;
  promoStartsAt?: string | null;
  promoEndsAt?: string | null;
};
