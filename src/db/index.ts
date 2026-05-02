import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { resolveDatabaseUrl } from '@/lib/resolve-database-url';

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
