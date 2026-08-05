/**
 * Connection-string handling shared by the app and the db scripts.
 *
 * Deliberately free of `server-only` so the migrate/seed scripts can import it.
 */

/**
 * Forces `sslmode=verify-full`.
 *
 * Neon hands out URLs with `sslmode=require`. Today node-postgres treats that
 * as an alias for `verify-full`, but it warns that pg 9 will switch it to
 * libpq semantics, which skip certificate verification. Pinning the strict mode
 * keeps the current (safer) behaviour across that upgrade instead of silently
 * downgrading to an unverified connection.
 *
 * Applied in code rather than in `.env.local` because `neon env pull` rewrites
 * that file and would drop the change.
 */
export function withStrictSsl(connectionString: string): string {
  try {
    const url = new URL(connectionString);

    // Only rewrite the loose modes; leave an explicit choice alone.
    const mode = url.searchParams.get("sslmode");
    if (mode === null || mode === "require" || mode === "prefer" || mode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
    }

    return url.toString();
  } catch {
    // Not a parseable URL (e.g. a libpq key=value DSN) — hand it back untouched.
    return connectionString;
  }
}

/** Pooled endpoint, for serving web requests. */
export function requirePooledUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "Missing DATABASE_URL. Run `npx neon@latest env pull` to restore it.",
    );
  }

  return withStrictSsl(url);
}

/** Direct endpoint, for DDL — PgBouncer cannot carry migrations reliably. */
export function requireDirectUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "Missing DATABASE_URL_UNPOOLED. Run `npx neon@latest env pull`.",
    );
  }

  return withStrictSsl(url);
}
