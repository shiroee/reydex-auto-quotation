import Link from "next/link";

import { ReydexMark } from "@/components/brand/reydex-mark";
import { getSession, isAdmin } from "@/lib/auth/session";
import { brandLogo } from "@/lib/brand";

import { AppNav } from "./app-nav";

/**
 * The header every page in the app shell wears: lockup, primary navigation, and
 * whatever the page puts on the right (its New button, sign out, …).
 *
 * Not a layout, because the printable quotation deliberately has none of this —
 * it renders a document, not a page of the app.
 *
 * Async so the navigation can be told whether to offer Users without every page
 * having to pass its session down. `getSession()` is memoised per render pass,
 * so this costs nothing on pages that already called `requireSession()`.
 */
export async function AppHeader({ children }: { children?: React.ReactNode }) {
  const session = await getSession();
  return (
    /*
     * One line from `md` up — lockup, navigation, actions. Below that the
     * navigation is given the full width, so it wraps onto a line of its own and
     * the lockup keeps the page's action beside it rather than being squeezed
     * against five section links. `order` is what puts the actions back after
     * the navigation once all three fit on one line.
     */
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gold-500/10 px-5 py-3.5 sm:px-8 sm:py-4">
      <Link
        href="/dashboard"
        className="order-1 flex shrink-0 items-center gap-3"
      >
        <ReydexMark logo={brandLogo} height={34} priority />
      </Link>

      {children ? (
        <div className="order-2 ml-auto flex items-center gap-3 sm:gap-4 md:order-3">
          {children}
        </div>
      ) : null}

      {/*
       * Bleeds into the header's own padding while it is on its own line, so the
       * rail scrolls edge to edge: the negative margin cancels the padding, and
       * the matching padding inside puts the first link back under the lockup.
       * Both have to track `px-5 sm:px-8` above, hence the second pair.
       */}
      <AppNav
        canManageUsers={isAdmin(session)}
        className="order-3 -mx-5 w-full px-5 sm:-mx-8 sm:px-8 md:order-2 md:mx-0 md:w-auto md:px-0"
      />
    </header>
  );
}
