/** Keeps the account menu and workspace selector from staying open together. */
export const OFFLINE_OVERLAY_OPEN = "flipvise:offline-overlay-open";

export type OfflineOverlaySource = "account" | "workspace" | "settings";

export function notifyOfflineOverlayOpen(source: OfflineOverlaySource): void {
  window.dispatchEvent(
    new CustomEvent(OFFLINE_OVERLAY_OPEN, { detail: { source } }),
  );
}

export function listenForOfflineOverlayOpen(
  self: OfflineOverlaySource,
  onClose: () => void,
): () => void {
  const handler = (event: Event) => {
    const source = (event as CustomEvent<{ source?: OfflineOverlaySource }>).detail
      ?.source;
    if (source && source !== self) onClose();
  };
  window.addEventListener(OFFLINE_OVERLAY_OPEN, handler);
  return () => window.removeEventListener(OFFLINE_OVERLAY_OPEN, handler);
}
