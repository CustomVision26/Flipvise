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

function createDb() {
  const sql = neon(resolveDatabaseUrl());
  return drizzle({ client: sql });
}

type AppDatabase = ReturnType<typeof createDb>;

let dbInstance: AppDatabase | null = null;

function getDb(): AppDatabase {
  if (!dbInstance) {
    dbInstance = createDb();
  }
  return dbInstance;
}

/**
 * Lazy client so importing `@/db` during `next build` (e.g. route module graph)
 * does not require `DATABASE_URL` until a query actually runs.
 */
export const db = new Proxy({} as AppDatabase, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
}) as AppDatabase;
