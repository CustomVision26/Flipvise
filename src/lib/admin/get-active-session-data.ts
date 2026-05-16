export async function getActiveSessionData(): Promise<Map<string, number>> {
  try {
    const res = await fetch(
      "https://api.clerk.com/v1/sessions?status=active&limit=500",
      {
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return new Map();
    const body: unknown = await res.json();
    const sessions: { user_id: string }[] = Array.isArray(body)
      ? (body as { user_id: string }[])
      : ((body as { data?: { user_id: string }[] }).data ?? []);
    const sessionCounts = new Map<string, number>();
    for (const s of sessions) {
      sessionCounts.set(s.user_id, (sessionCounts.get(s.user_id) ?? 0) + 1);
    }
    return sessionCounts;
  } catch {
    return new Map();
  }
}
