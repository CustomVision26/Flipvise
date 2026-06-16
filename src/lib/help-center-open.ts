/** Dispatched to open the in-app Help Center sheet from the top nav. */
export const HELP_CENTER_OPEN_EVENT = "flipvise:open-help-center";

export function openHelpCenter(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HELP_CENTER_OPEN_EVENT));
}
