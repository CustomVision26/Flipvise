/**
 * Canonical URL prefixes for AI Document Studio.
 * Keep route strings here so nav, redirects, and revalidation stay aligned.
 */

export const AI_DOC_STUDIO_BASE = "/dashboard/ai-doc-studio";

/** AI Essay feature subtree inside the studio. */
export const AI_ESSAY_STUDIO_BASE = `${AI_DOC_STUDIO_BASE}/ai-essay`;

/** Legacy prefix — still accepted via redirects. */
export const LEGACY_ESSAY_DASHBOARD_BASE = "/dashboard/essay";

export function aiEssayStudioPath(
  suffix: "" | `/${string}` = "",
): string {
  if (!suffix || suffix === "/") return AI_ESSAY_STUDIO_BASE;
  return `${AI_ESSAY_STUDIO_BASE}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
}
