export const FLIPVISE_OPEN_SIGN_UP_EVENT = "flipvise:open-sign-up";

/** Clerk `signUpUrl` hash — never open Clerk’s hosted SignUp UI. */
export const FLIPVISE_SIGN_UP_HASH = "flipvise-sign-up";

export type OpenFlipviseSignUpDetail = {
  email?: string;
};

export function openFlipviseSignUp(detail: OpenFlipviseSignUpDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<OpenFlipviseSignUpDetail>(FLIPVISE_OPEN_SIGN_UP_EVENT, {
      detail,
    }),
  );
}

export function flipviseSignUpUrl(): string {
  return `/#${FLIPVISE_SIGN_UP_HASH}`;
}
