"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button for the sign-out form. Split into its own client component so
 * the form itself can stay a server-rendered `<form action={signOut}>` — that
 * keeps sign-out working without JavaScript, which an inline client closure
 * around the action would not.
 */
export function SignOutSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-gold-500/25 px-3.5 py-2 text-sm font-medium text-gold-100/80 transition-colors hover:border-gold-400/45 hover:text-gold-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 disabled:opacity-50"
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
