/** Internal prefix — stripped before showing the message in UI. */
export const CHECKOUT_PLAN_NO_DISCOUNT_PROMO_PREFIX =
  "__CHECKOUT_PLAN_NO_DISCOUNT__" as const;

export const CHECKOUT_PROMO_ALREADY_REDEEMED_PREFIX =
  "__CHECKOUT_PROMO_ALREADY_REDEEMED__" as const;

export const CHECKOUT_PLAN_CHANGE_REQUIRED_PREFIX =
  "__CHECKOUT_PLAN_CHANGE_REQUIRED__" as const;

export const CHECKOUT_PLAN_CHANGE_NO_PROMO_PREFIX =
  "__CHECKOUT_PLAN_CHANGE_NO_PROMO__" as const;

export function checkoutPlanChangeRequiredError(): Error {
  return new Error(
    `${CHECKOUT_PLAN_CHANGE_REQUIRED_PREFIX}You already have an active subscription. Confirm your plan change on this page — Stripe will prorate your existing subscription.`,
  );
}

export function isCheckoutPlanChangeRequiredError(message: string): boolean {
  return message.startsWith(CHECKOUT_PLAN_CHANGE_REQUIRED_PREFIX);
}

export function checkoutPlanChangeRequiredUserMessage(message: string): string {
  if (!isCheckoutPlanChangeRequiredError(message)) return message;
  return message.slice(CHECKOUT_PLAN_CHANGE_REQUIRED_PREFIX.length);
}

export function checkoutPlanNoDiscountPromoError(planName: string): Error {
  const label = planName.trim() || "This";
  const subject =
    label === "This" ? "This plan" : `The ${label} plan`;
  return new Error(
    `${CHECKOUT_PLAN_NO_DISCOUNT_PROMO_PREFIX}${subject} is not currently offering a discount. Please remove your promotion code below, then choose your plan again.`,
  );
}

export function isCheckoutPlanNoDiscountPromoError(message: string): boolean {
  return message.startsWith(CHECKOUT_PLAN_NO_DISCOUNT_PROMO_PREFIX);
}

export function checkoutPlanNoDiscountPromoUserMessage(message: string): string {
  if (!isCheckoutPlanNoDiscountPromoError(message)) return message;
  return message.slice(CHECKOUT_PLAN_NO_DISCOUNT_PROMO_PREFIX.length);
}

export function checkoutPromoAlreadyRedeemedError(promoCode: string): Error {
  const code = promoCode.trim() || "This promotion";
  return new Error(
    `${CHECKOUT_PROMO_ALREADY_REDEEMED_PREFIX}${code}`,
  );
}

export function isCheckoutPromoAlreadyRedeemedError(message: string): boolean {
  return message.startsWith(CHECKOUT_PROMO_ALREADY_REDEEMED_PREFIX);
}

export function checkoutPromoAlreadyRedeemedUserMessage(message: string): string {
  if (!isCheckoutPromoAlreadyRedeemedError(message)) return message;
  const code = message.slice(CHECKOUT_PROMO_ALREADY_REDEEMED_PREFIX.length);
  return `You already used the ${code} promotion on a previous subscription. Each customer can only receive this discount once per promo period. Remove the code to continue — plan changes are prorated automatically.`;
}

export function checkoutPlanChangeNoPromoError(): Error {
  return new Error(
    `${CHECKOUT_PLAN_CHANGE_NO_PROMO_PREFIX}Promotion codes cannot be applied when changing plans. You already have an active subscription — Stripe will prorate the difference automatically. Remove the promo code to continue.`,
  );
}

export function isCheckoutPlanChangeNoPromoError(message: string): boolean {
  return message.startsWith(CHECKOUT_PLAN_CHANGE_NO_PROMO_PREFIX);
}

export function checkoutPlanChangeNoPromoUserMessage(message: string): string {
  if (!isCheckoutPlanChangeNoPromoError(message)) return message;
  return message.slice(CHECKOUT_PLAN_CHANGE_NO_PROMO_PREFIX.length);
}

/** Maps server checkout errors to user-facing toast copy. */
export function checkoutErrorUserMessage(message: string): string {
  if (isCheckoutPlanNoDiscountPromoError(message)) {
    return checkoutPlanNoDiscountPromoUserMessage(message);
  }
  if (isCheckoutPromoAlreadyRedeemedError(message)) {
    return checkoutPromoAlreadyRedeemedUserMessage(message);
  }
  if (isCheckoutPlanChangeNoPromoError(message)) {
    return checkoutPlanChangeNoPromoUserMessage(message);
  }
  if (isCheckoutPlanChangeRequiredError(message)) {
    return checkoutPlanChangeRequiredUserMessage(message);
  }
  return message;
}

export function shouldClearPromoOnCheckoutError(message: string): boolean {
  return (
    isCheckoutPlanNoDiscountPromoError(message) ||
    isCheckoutPromoAlreadyRedeemedError(message) ||
    isCheckoutPlanChangeNoPromoError(message)
  );
}
