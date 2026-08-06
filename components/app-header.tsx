import Link from "next/link";

import { ReydexMark } from "@/components/brand/reydex-mark";
import { brandLogo } from "@/lib/brand";

import { AppNav } from "./app-nav";

/**
 * The header every page in the app shell wears: lockup, primary navigation, and
 * whatever the page puts on the right (its New button, sign out, …).
 *
 * Not a layout, because the printable quotation deliberately has none of this —
 * it renders a document, not a page of the app.
 */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gold-500/10 px-5 py-4 sm:px-8">
      <Link href="/dashboard" className="flex shrink-0 items-center gap-3">
        <ReydexMark logo={brandLogo} height={34} priority />
      </Link>

      <AppNav />

      {children ? (
        <div className="ml-auto flex items-center gap-4">{children}</div>
      ) : null}
    </header>
  );
}
