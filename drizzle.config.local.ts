import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig } from 'drizzle-kit';

// Match Next.js: `.env` then `.env.local` (override). Ensures `db:push:local`
// uses the same `DATABASE_URL` as `next dev` when the URL lives only in `.env`.
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

export default defineConfig({
  out: './drizzle-local',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
