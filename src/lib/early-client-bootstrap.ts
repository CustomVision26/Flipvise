/**
 * Runs once when the client bundle first evaluates (before React mount).
 * Replaces inline layout <script> tags that React 19 no longer allows in components.
 */
function runEarlyClientBootstrap(): void {
  if (typeof window === "undefined") return;

  const host = window.location.hostname;
  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "10.0.2.2";
  const isNativeShell = (() => {
    try {
      const cap = (
        window as {
          Capacitor?: { isNativePlatform?: () => boolean };
        }
      ).Capacitor;
      return (
        /FlipviseNative\//.test(navigator.userAgent) ||
        Boolean(cap?.isNativePlatform?.())
      );
    } catch {
      return /FlipviseNative\//.test(navigator.userAgent);
    }
  })();

  if (
    process.env.NODE_ENV === "development" &&
    (isLocal || isNativeShell) &&
    "serviceWorker" in navigator
  ) {
    const reloadKey = "flipvise-dev-sw-reset-v17";
    if (sessionStorage.getItem(reloadKey)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        const hadController = Boolean(navigator.serviceWorker.controller);
        const cacheKeys =
          "caches" in window ? await caches.keys() : ([] as string[]);
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        sessionStorage.setItem(reloadKey, "1");
        // Reload only when something was actually controlling/caching the page.
        if (hadController || registrations.length > 0 || cacheKeys.length > 0) {
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
