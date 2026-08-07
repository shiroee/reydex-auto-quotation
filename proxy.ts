import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. This is an *optimistic*
 * cookie-only check that keeps unauthenticated visitors out of the app shell;
 * every page and Server Action still verifies the session itself via
 * `requireSession()` in `lib/auth/session.ts`.
 */
const optimisticGuard = auth.middleware({ loginUrl: "/login" });

export default function proxy(request: NextRequest) {
  /*
   * Only guard navigations.
   *
   * `auth.middleware()` (SDK 0.4.2-beta) validates the session by forwarding the
   * incoming request to the auth server's `get-session` endpoint, which answers
   * 415 Unsupported Media Type for anything that is not a plain GET. On a
   * matched route that turns every Server Action POST into a redirect to
   * `loginUrl` before the action runs — silently breaking form submissions and,
   * worse, sign-out (the redirect looks like success while the session survives).
   *
   * Skipping non-GET here costs nothing: this check is optimistic by design and
   * reads only the cookie, while the actual gate is `requireSession()` inside
   * each page and action.
   */
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  return optimisticGuard(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/quotations/:path*",
    "/customers/:path*",
    "/quotation-types/:path*",
    "/items/:path*",
    "/users/:path*",
  ],
};
