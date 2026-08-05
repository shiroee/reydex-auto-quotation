"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * Browser-side Neon Auth client.
 *
 * The sign-in form itself posts through a Server Action so it keeps working
 * without JavaScript; this client is here for client-side session reads and
 * follow-up flows (sign out from a menu, password change, OAuth buttons).
 */
export const authClient = createAuthClient();
