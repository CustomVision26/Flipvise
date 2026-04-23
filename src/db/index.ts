import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

/** Same URL you should target for `npm run db:ensure-team-workspace-events` (Neon/Vercel often expose several names). */
function resolveDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    "";
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add DATABASE_URL (or POSTGRES_URL from Neon/Vercel) to .env.local.",
    );
  }
  return url;
}

const sql = neon(resolveDatabaseUrl());
export const db = drizzle({ client: sql });
