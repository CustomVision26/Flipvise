/** Query keys that must not appear in the browser address bar. */
export const SENSITIVE_URL_QUERY_KEYS = [
  "userid",
  "userId",
  "session_id",
  "setup_intent_client_secret",
  "teamMemberId",
  "clerkUserId",
] as const;

const SENSITIVE_KEY_SET = new Set<string>(
  SENSITIVE_URL_QUERY_KEYS.map((k) => k.toLowerCase()),
);

/** Team Admin / Teacher still use `teamMemberId` as a workspace selector. */
const TEAM_MEMBER_ID_ALLOWED_PATH_PREFIXES = [
  "/dashboard/team-admin",
  "/teacher",
] as const;

function pathnameAllowsTeamMemberId(pathname: string): boolean {
  return TEAM_MEMBER_ID_ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSensitiveUrlQueryKey(key: string, pathname = ""): boolean {
  const k = key.trim().toLowerCase();
  if (k === "teammemberid") {
    return !pathnameAllowsTeamMemberId(pathname);
  }
  return SENSITIVE_KEY_SET.has(k);
}

/** Dashboard `plan=` is a billing slug, not a product picker — strip it from /dashboard. */
export function isDashboardSensitivePlanKey(pathname: string, key: string): boolean {
  return pathname === "/dashboard" && key.trim().toLowerCase() === "plan";
}

export function stripSensitiveUrlSearchParams(
  params: URLSearchParams,
  pathname = "",
): URLSearchParams {
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (isSensitiveUrlQueryKey(key, pathname)) continue;
    if (isDashboardSensitivePlanKey(pathname, key)) continue;
    next.append(key, value);
  }
  return next;
}

export function stripSensitiveQueryFromPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/dashboard";
  const qIndex = trimmed.indexOf("?");
  if (qIndex < 0) return trimmed;
  const pathname = trimmed.slice(0, qIndex);
  const search = trimmed.slice(qIndex + 1);
  const hashIndex = search.indexOf("#");
  const query = hashIndex >= 0 ? search.slice(0, hashIndex) : search;
  const hash = hashIndex >= 0 ? search.slice(hashIndex) : "";
  const cleaned = stripSensitiveUrlSearchParams(
    new URLSearchParams(query),
    pathname,
  ).toString();
  return `${pathname}${cleaned ? `?${cleaned}` : ""}${hash}`;
}

export function searchRecordToUrlSearchParams(
  sp: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry) params.append(key, entry);
      }
    } else if (value) {
      params.set(key, value);
    }
  }
  return params;
}
