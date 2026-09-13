/** Blob/data URLs and malformed strings must never be saved or sent to next/image. */
export function persistableHttpImageUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return trimmed;
  } catch {
    // drop invalid URLs instead of failing the whole save
  }
  return null;
}
