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
