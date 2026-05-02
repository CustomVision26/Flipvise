function firstNonEmpty(...keys: (keyof NodeJS.ProcessEnv)[]): string | undefined {
  for (const key of keys) {
    const v = process.env[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
  }
  return undefined;
}

/**
 * Same URL resolution as legacy `src/db/index.ts` so one-off DB scripts hit the same
 * database as `next dev` (Neon often provides `POSTGRES_URL` / `POSTGRES_PRISMA_URL`).
 */
export function resolveDatabaseUrl(): string {
  const url = firstNonEmpty(
    "DATABASE_URL",
    "POSTGRES_URL",
    "POSTGRES_PRISMA_URL",
  );
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add DATABASE_URL (or POSTGRES_URL from Neon/Vercel) to .env.local.",
    );
  }
  return url;
}

export function resolveDatabaseUrlSource():
  | "DATABASE_URL"
  | "POSTGRES_URL"
  | "POSTGRES_PRISMA_URL" {
  if (firstNonEmpty("DATABASE_URL")) return "DATABASE_URL";
  if (firstNonEmpty("POSTGRES_URL")) return "POSTGRES_URL";
  return "POSTGRES_PRISMA_URL";
}
