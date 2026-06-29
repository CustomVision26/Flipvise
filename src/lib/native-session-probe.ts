/**
 * Client-side polling until Clerk session cookies are visible to the Next server.
 * WebViews (especially Android) can report `isSignedIn` before `__session` reaches SSR.
 */
export async function waitForServerSession(
  maxMs = 10_000,
  intervalMs = 400,
): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("/api/native/session-probe", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { signedIn?: boolean };
        if (data.signedIn) return true;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}
