"use client";

import { useActionState } from "react";

import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  // `signOut` takes no arguments and redirects, so state is only used to expose
  // the pending flag for the button label.
  const [, formAction, isPending] = useActionState(async () => {
    await signOut();
  }, null);

  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-gold-500/25 px-3.5 py-2 text-sm font-medium text-gold-100/80 transition-colors hover:border-gold-400/45 hover:text-gold-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300 disabled:opacity-50"
      >
        {isPending ? "Signing out…" : "Sign out"}
      </button>
    </form>
  );
}
