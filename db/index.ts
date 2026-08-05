import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { requirePooledUrl } from "./connection";
import * as schema from "./schema";

/**
 * Uses node-postgres rather than the Neon WebSocket driver for two reasons:
 * creating a quotation writes the header, its line items and the recalculated
 * total in one interactive transaction, and `@neondatabase/serverless` needs a
 * WebSocket implementation that Node 20 does not provide as a global.
 *
 * The pool is module-scoped so it is reused across requests in the same server
 * instance. When this is deployed to Vercel, wrap it with `attachDatabasePool`
 * from `@vercel/functions` so idle connections are released between invocations.
 */
const pool = new Pool({
  connectionString: requirePooledUrl(),
  // Neon suspends idle compute; keep the local pool small and let it recycle.
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;

export * from "./schema";
