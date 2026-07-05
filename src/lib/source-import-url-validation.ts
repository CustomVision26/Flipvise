/** Client- and server-safe URL checks for the From source import tab. */

const APP_STORE_MESSAGE =
  "App store links cannot be used for flashcard import. Use a Wikipedia or article URL, or upload a .txt or PDF file.";

const PRIVATE_CHAT_MESSAGE =
  "Private chat links (ChatGPT, Claude, etc.) cannot be fetched. Copy the text from your chat and add it using Plain text, or upload a file.";

const PRIVATE_CHAT_HOSTS = [
  "chatgpt.com",
  "chat.openai.com",
  "claude.ai",
  "gemini.google.com",
  "bard.google.com",
] as const;

function isPrivateChatHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return PRIVATE_CHAT_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  );
}

export function isPrivateChatImportUrl(raw: string): boolean {
  try {
    return isPrivateChatHost(new URL(raw.trim()).hostname);
  } catch {
    return false;
  }
}

export function getUnsupportedImportUrlReason(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Only http and https URLs are supported.";
    }
    const host = parsed.hostname.toLowerCase();
    if (isPrivateChatHost(host)) {
      return PRIVATE_CHAT_MESSAGE;
    }
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
