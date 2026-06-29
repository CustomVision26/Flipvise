/** Minimum branded splash time so launch feels intentional (not a flash). */
const MIN_SPLASH_MS = 5000;

let appReady = false;
let minElapsed = false;
let dismissed = false;

function tryDismissBootSplash(): void {
  if (dismissed || !appReady || !minElapsed) return;
  dismissed = true;
  window.__flipviseDismissBootSplash?.();
}

/** Call when lock gate / shell init is done and offline UI may show. */
export function markBootSplashReady(): void {
  appReady = true;
  tryDismissBootSplash();
}

/** Start the minimum display timer as soon as the JS bundle runs. */
export function startBootSplashTimer(): void {
  window.setTimeout(() => {
    minElapsed = true;
    tryDismissBootSplash();
  }, MIN_SPLASH_MS);
}
