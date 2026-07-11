/** Close focused popovers/selects before large React tree updates. */
export function dismissOpenOverlays(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}

/** Run after portal teardown (e.g. Select popup) has committed. */
export function afterOverlayDismiss(callback: () => void): void {
  if (typeof window === "undefined") {
    callback();
    return;
  }
  window.requestAnimationFrame(() => {
    callback();
  });
}
