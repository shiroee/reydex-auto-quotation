import type { Metadata } from "next";
import Link from "next/link";
import {
  LuFileText,
  LuHistory,
  LuLayoutTemplate,
  LuPackage,
  LuPlus,
  LuUserCog,
  LuUsers,
} from "react-icons/lu";

import { AppHeader } from "@/components/app-header";
import { isAdmin, requireSession } from "@/lib/auth/session";
import { COMPANY_NAME } from "@/lib/brand";

import { signOut } from "@/app/login/actions";

import { SignOutSubmit } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Session-dependent, so never prerendered.
export const dynamic = "force-dynamic";

/** The four things kept here, each with what it is for. */
const DESTINATIONS = [
  {
    href: "/quotations",
    label: "Quotations",
    hint: "Everything raised so far",
    Icon: LuFileText,
  },
  {
    href: "/customers",
    label: "Customers",
    hint: "Who quotations are addressed to",
    Icon: LuUsers,
  },
  {
    href: "/quotation-types",
    label: "Quotation types",
    hint: "Layout, letter body and terms",
    Icon: LuLayoutTemplate,
  },
  {
    href: "/items",
    label: "Items",
    hint: "The catalogue and its prices",
    Icon: LuPackage,
  },
  {
    href: "/activity",
    label: "Activity",
    hint: "Who changed what, and when",
    Icon: LuHistory,
  },
] as const;

/** Offered alongside them, but only to an administrator. */
const ADMIN_DESTINATION = {
  href: "/users",
  label: "Users",
  hint: "Who can sign in to Reydex",
  Icon: LuUserCog,
} as const;

export default async function DashboardPage() {
  const session = await requireSession();
  const { user } = session;
  const displayName = user.name?.trim() || user.email;

  const destinations = isAdmin(session)
    ? [...DESTINATIONS, ADMIN_DESTINATION]
    : DESTINATIONS;

  return (
    <main className="reydex-auth-surface flex flex-1 flex-col">
      <AppHeader>
        <form action={signOut}>
          <SignOutSubmit />
        </form>
      </AppHeader>

      <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 sm:py-16">
        <div className="w-full max-w-2xl">
          <div className="reydex-card rounded-2xl p-6 text-center backdrop-blur-xl sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500/70">
              Signed in
            </p>
            {/* Wrappable: an email address has no space to break at on a phone. */}
            <h1 className="mt-3 text-xl font-semibold tracking-tight wrap-break-word text-gold-100 sm:text-2xl">
              Welcome, {displayName}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gold-100/55">
              Your {COMPANY_NAME} account is authenticated.
            </p>

            <div className="mt-7 flex justify-center">
              <Link
                href="/quotations/new"
                className="reydex-submit inline-flex h-10 items-center gap-1.5 rounded-lg px-5 text-sm font-semibold"
              >
                <LuPlus aria-hidden className="size-4" />
                New quotation
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {destinations.map(({ href, label, hint, Icon }) => (
              <Link
                key={href}
                href={href}
                className="reydex-card flex items-center gap-3.5 rounded-xl px-4 py-3.5 transition-colors hover:border-gold-400/35"
              >
                <Icon
                  aria-hidden
                  className="size-5 shrink-0 text-gold-300/80"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-gold-100/90">
                    {label}
                  </span>
                  <span className="truncate text-xs text-gold-100/40">
                    {hint}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
