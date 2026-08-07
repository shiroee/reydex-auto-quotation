import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "./server";

/**
 * Reads the current session. Memoised for the duration of a single render pass
 * so a layout and its pages don't each pay for a session lookup.
 */
export const getSession = cache(async () => {
  const { data } = await auth.getSession();
  return data ?? null;
});

/**
 * Authorisation check for anything that must not render for a visitor.
 *
 * `proxy.ts` already turns most unauthenticated traffic away, but that check is
 * cookie-only and optimistic — this is the one that actually gates data, and it
 * runs as close to the page as possible.
 */
export async function requireSession() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return session;
}

/**
 * Whether this session may administer staff accounts.
 *
 * `admin` is the role Better Auth's admin plugin checks for; see
 * `lib/users/service.ts`. Read from the session, which the SDK serves from a
 * signed cookie for up to `sessionDataTtl`, so a role just changed elsewhere can
 * be up to five minutes stale here. That is only ever a cosmetic staleness: the
 * auth server re-checks the role on every `auth.admin.*` call, so a cookie that
 * still claims `admin` cannot actually do anything with it.
 */
export function isAdmin(session: { user?: { role?: string | null } } | null) {
  return session?.user?.role === "admin";
}

/**
 * Gate for the account-management pages and their actions.
 *
 * Sends a signed-in non-administrator back to the dashboard rather than showing
 * a 403: the navigation only offers Users to administrators, so arriving here
 * without the role means the URL was typed or a role was revoked mid-session,
 * and neither is worth an error page. (`forbidden()` would be the more precise
 * answer but is still behind `experimental.authInterrupts`.)
 */
export async function requireAdmin() {
  const session = await requireSession();

  if (!isAdmin(session)) {
    redirect("/dashboard");
  }

  return session;
}
