/**
 * Online check for AI Recall™ (browser + Capacitor).
 * Never throws — offline is a soft gate with a friendly UI.
 */

export async function isNetworkOnlineForAiRecall(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return false;
  }

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      return status.connected;
    }
  } catch {
    // Capacitor unavailable in web — fall through to navigator.
  }

  if (typeof navigator !== "undefined") {
    return navigator.onLine;
  }

  return true;
}
