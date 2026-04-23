/**
 * Team features require Drizzle migrations `0004`+ (teams, team_members, …).
 * If those tables are missing, queries throw — this wrapper returns a fallback instead of crashing.
 */
export async function tryTeamQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
