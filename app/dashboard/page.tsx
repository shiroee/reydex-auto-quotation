import type { Metadata } from "next";
import Link from "next/link";

import { ReydexMark } from "@/components/brand/reydex-mark";
import { requireSession } from "@/lib/auth/session";
import { brandLogo, COMPANY_NAME } from "@/lib/brand";

import { signOut } from "@/app/login/actions";

import { SignOutSubmit } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Session-dependent, so never prerendered.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const { user } = session;
  const displayName = user.name?.trim() || user.email;

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-gold-500/10 px-5 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          {/* The lockup carries the wordmark, so no separate REYDEX text here. */}
          <ReydexMark logo={brandLogo} height={38} priority />
          {!brandLogo ? (
            <span className="text-sm font-semibold tracking-[0.13em] text-gold-200">
              REYDEX
            </span>
          ) : null}
        </div>
        <form action={signOut}>
          <SignOutSubmit />
        </form>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8">
        <div className="reydex-card w-full max-w-lg rounded-2xl p-7 text-center backdrop-blur-xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500/70">
            Signed in
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gold-100">
            Welcome, {displayName}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gold-100/55">
            Your {COMPANY_NAME} account is authenticated.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/quotations/new"
              className="reydex-submit inline-flex h-10 items-center rounded-lg px-5 text-sm font-semibold"
            >
              New quotation
            </Link>
            <Link
              href="/quotations"
              className="inline-flex h-10 items-center rounded-lg border border-gold-500/25 px-5 text-sm font-medium text-gold-100/80 transition-colors hover:border-gold-400/45 hover:text-gold-100"
            >
              All quotations
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
