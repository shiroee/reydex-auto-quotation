import { auth } from "@/lib/auth/server";

/**
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. This is an *optimistic*
 * cookie-only check that keeps unauthenticated visitors out of the app shell;
 * every page and Server Action still verifies the session itself via
 * `requireSession()` in `lib/auth/session.ts`.
 */
export default auth.middleware({
  loginUrl: "/login",
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
