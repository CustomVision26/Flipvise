/** Client- and server-safe URL checks for the From source import tab. */

const APP_STORE_MESSAGE =
  "App store links cannot be used for flashcard import. Use a Wikipedia or article URL, or upload a .txt or PDF file.";

export function getUnsupportedImportUrlReason(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Only http and https URLs are supported.";
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === "play.google.com" ||
      host.endsWith(".play.google.com") ||
      host === "apps.apple.com" ||
      host.endsWith(".apps.apple.com")
    ) {
      return APP_STORE_MESSAGE;
    }
  } catch {
    return null;
  }
  return null;
}

export function isAppStoreImportUrl(raw: string): boolean {
  return getUnsupportedImportUrlReason(raw) === APP_STORE_MESSAGE;
}
