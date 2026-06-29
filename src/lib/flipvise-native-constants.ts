/** Appended to the WebView user agent via `capacitor.config.ts`. */
export const FLIPVISE_NATIVE_UA_MARKER = "FlipviseNative";

/** Query param set when navigating from the bundled offline shell to the live site. */
export const FLIPVISE_NATIVE_QUERY_PARAM = "flipvise_native";

/** sessionStorage key — native-signin → auth/continue hops before giving up. */
export const AUTH_CONTINUE_ATTEMPTS_KEY = "flipvise.authContinueAttempts";

export const MAX_AUTH_CONTINUE_ATTEMPTS = 2;
