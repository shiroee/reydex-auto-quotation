import { auth } from "@/lib/auth/server";

type RouteContext = { params: Promise<{ path: string[] }> };

const handlers = auth.handler();

/**
 * Better Auth path prefixes that must not be reachable from the public
 * internet. Reydex accounts are issued by an administrator via
 * `npm run create-user`, so leaving the catch-all fully open would let anyone
 * self-register into the quotation system.
 */
const BLOCKED_SEGMENTS = new Set(["sign-up"]);

async function proxy(
  request: Request,
  context: RouteContext,
  handle: (request: Request, context: RouteContext) => Promise<Response>,
): Promise<Response> {
  const { path } = await context.params;

  if (path.length > 0 && BLOCKED_SEGMENTS.has(path[0])) {
    // 404 rather than 403 so the endpoint's existence is not advertised.
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return handle(request, context);
}

/**
 * Catch-all proxy for the Managed Better Auth API: sign-in, session refresh,
 * OAuth callbacks, email verification and password reset all route through
 * here so the browser never talks to the Neon Auth server directly.
 */
export function GET(request: Request, context: RouteContext) {
  return proxy(request, context, handlers.GET);
}

export function POST(request: Request, context: RouteContext) {
  return proxy(request, context, handlers.POST);
}
