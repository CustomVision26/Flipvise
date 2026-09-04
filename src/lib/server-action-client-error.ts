/**
 * Production Next.js omits thrown Server Action error messages. Return
 * `{ ok: false, error }` from actions instead of throwing user-facing errors.
 */

export function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = (error as { digest: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export function isProductionOmittedServerError(message: string): boolean {
  return (
    message.includes("Server Components render") ||
    message.includes("digest property is included")
  );
}

export function userFacingServerActionError(
  error: unknown,
  fallback: string,
): string {
  const raw = error instanceof Error ? error.message : fallback;
  if (!raw.trim() || isProductionOmittedServerError(raw)) {
    return fallback;
  }
  return raw;
}
