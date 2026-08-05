import { defineConfig } from "drizzle-kit";

/**
 * Migrations run over the *direct* (unpooled) connection — PgBouncer cannot
 * carry DDL sessions reliably. See the Neon guidance on pooled vs direct
 * connections. Run generate/migrate through the npm scripts so .env.local is
 * loaded; drizzle-kit does not read .env.local on its own.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
