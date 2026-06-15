import type { PlanDiscount } from "@/lib/plan-config-types";

/** Returns the discounted price given a base price and discount config. */
export function applyDiscount(price: number, discount: PlanDiscount): number {
  if (!discount.active || discount.value <= 0) return price;
  if (discount.type === "percentage") {
    return Math.max(0, price - price * (discount.value / 100));
  }
  return Math.max(0, price - discount.value);
}
