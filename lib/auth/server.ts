import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    // Fail loudly at import time rather than surfacing an opaque 502 from the
    // auth proxy on the first sign-in attempt.
    throw new Error(
      `Missing ${name}. Run \`npx neon@latest env pull\` to restore Neon values, ` +
        `and set NEON_AUTH_COOKIE_SECRET (32+ chars) in .env.local.`,
    );
  }

  return value;
}

/**
 * Server-side Neon Auth (Managed Better Auth) instance.
 *
 * Provides `.handler()` for the API proxy route, `.middleware()` for route
 * protection in `proxy.ts`, and the Better Auth server methods used by our
 * server actions (`signIn.email`, `getSession`, `signOut`).
 */
export const auth = createNeonAuth({
  baseUrl: required("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: required("NEON_AUTH_COOKIE_SECRET"),
  },
  logLevel: process.env.NODE_ENV === "production" ? "warn" : "debug",
});
