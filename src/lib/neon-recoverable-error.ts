/**
 * True when a Neon/Drizzle read failed transiently and callers may degrade (null / []).
 * Covers pool saturation, network blips, and missing-table/schema drift handled elsewhere.
 */
export function isRecoverableNeonReadError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 10 && current && typeof current === "object"; depth++) {
    const obj = current as Record<string, unknown>;
    if (obj["neon:retryable"] === true) return true;
    const message = typeof obj.message === "string" ? obj.message.toLowerCase() : "";
    if (
      message.includes("fetch failed") ||
      message.includes("error connecting to database") ||
      /too many database connection attempts/i.test(message) ||
      /failed to acquire permit/i.test(message)
    ) {
      return true;
    }
    current = obj.cause;
  }
  const flat = String(error).toLowerCase();
  return (
    flat.includes("fetch failed") ||
    flat.includes("error connecting to database") ||
    /too many database connection attempts/i.test(flat) ||
    /failed to acquire permit/i.test(flat)
  );
}
