/**
 * Runs once when the client bundle first evaluates (before React mount).
 * Replaces inline layout <script> tags that React 19 no longer allows in components.
 */
function runEarlyClientBootstrap(): void {
  if (typeof window === "undefined") return;

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "::1";

  if (
    process.env.NODE_ENV === "development" &&
    isLocal &&
    "serviceWorker" in navigator
  ) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    const reloadKey = "flipvise-dev-sw-reset";

    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.indexOf("flipvise") === 0)
              .map((key) => caches.delete(key)),
          );
        }
        if (hadController && !sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
        }
      })
      .catch(() => {});
  }

  try {
    const cap = (
      window as {
        Capacitor?: {
          isNativePlatform?: () => boolean;
          getPlatform?: () => string;
        };
      }
    ).Capacitor;
    const ua = navigator.userAgent;
    if (
      /FlipviseNative\//.test(ua) ||
      (cap?.isNativePlatform && cap.isNativePlatform())
    ) {
      const root = document.documentElement;
      root.dataset.flipviseNativeShell = "1";
      root.dataset.nativeShell = "1";
      const platform = cap?.getPlatform?.();
      if (platform) {
        root.dataset.platform = platform;
      } else if (/Android/i.test(ua)) {
        root.dataset.platform = "android";
      } else if (/iPhone|iPad|iPod/i.test(ua)) {
        root.dataset.platform = "ios";
      }
    }
  } catch {
    // Non-fatal — NativeAppBootstrap reconciles on mount.
  }
}

runEarlyClientBootstrap();
