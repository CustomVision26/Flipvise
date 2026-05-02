import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig } from "drizzle-kit";

/**
 * Production database URL for `npm run db:migrate:prod` / `db:push:prod` from your machine.
 * Create `.env.db.prod` in the repo root (gitignored) with e.g. `DATABASE_URL=postgresql://...`
 * — do not commit that file.
 */
config({ path: resolve(process.cwd(), ".env.db.prod") });

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
