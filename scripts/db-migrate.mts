#!/usr/bin/env tsx
/**
 * Applies pending Drizzle migrations to the linked Neon branch.
 *
 *   npm run db:generate   # write SQL into db/migrations after editing schema.ts
 *   npm run db:migrate    # apply them
 *
 * Uses the direct (unpooled) endpoint: DDL over PgBouncer is unreliable.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import { requireDirectUrl } from "../db/connection";

const pool = new Pool({ connectionString: requireDirectUrl() });

try {
  await migrate(drizzle(pool), { migrationsFolder: "./db/migrations" });
  console.log("\n✔ Migrations applied\n");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n✖ Migration failed: ${message}`);
  if (error instanceof Error && error.cause instanceof Error) {
    console.error(`  cause: ${error.cause.message}`);
  }
  console.error("");
  process.exitCode = 1;
} finally {
  await pool.end();
}
