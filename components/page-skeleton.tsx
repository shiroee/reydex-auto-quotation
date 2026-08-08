import { AppNav } from "@/components/app-nav";
import { ReydexMark } from "@/components/brand/reydex-mark";
import { brandLogo } from "@/lib/brand";

/**
 * The bones of a page, drawn by each segment's `loading.tsx` while the real one
 * fetches. Every listing here is `force-dynamic` and queries Neon, so without a
 * fallback a click on the navigation leaves the previous page on screen doing
 * nothing until the query lands — which reads as a dead link, not as work.
 *
 * The header is redrawn rather than reused: pages in this app each render their
 * own `AppHeader` instead of inheriting one from a layout, so a route-level
 * fallback replaces it along with the body. The mark and `AppNav` are the real
 * components — `AppNav` is a client component that reads the path, so during the
 * fallback it already highlights the section being opened and stays clickable
 * (navigation is interruptible, so a second click can overtake the first).
 *
 * What it cannot know is whether the session is an administrator, since that
 * needs the session cookie and a fallback that reads cookies can no longer be
 * prefetched — which is the whole point of it. So Users is left out until the
 * page itself arrives. One link appearing a moment late is a fairer trade than a
 * header of dead grey bars.
 */

/** One shimmering bar; `className` carries its size and any radius. */
export function SkeletonBar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`reydex-skeleton block rounded-md ${className ?? ""}`}
    />
  );
}

export function PageSkeleton({
  width = "max-w-7xl",
  action = false,
  children,
}: {
  /** Match the width the real page centres its content at, or it will jump. */
  width?: string;
  /** Reserve the header's right-hand slot, for pages carrying a New button. */
  action?: boolean;
  children: React.ReactNode;
}) {
  return (
    /*
     * `aria-busy` on the region plus one polite status line: a screen reader is
     * told the page is loading once, rather than reading out two dozen bars.
     */
    <main
      aria-busy="true"
      className="reydex-auth-surface flex flex-1 flex-col"
    >
      {/* Mirrors `AppHeader`'s own classes — the two have to line up exactly. */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-gold-500/10 px-5 py-3.5 sm:px-8 sm:py-4">
        <span className="order-1 flex shrink-0 items-center gap-3">
          <ReydexMark logo={brandLogo} height={34} priority />
        </span>

        {action ? (
          <div className="order-2 ml-auto flex items-center gap-3 sm:gap-4 md:order-3">
            <SkeletonBar className="h-10 w-28 rounded-lg sm:h-9" />
          </div>
        ) : null}

        <AppNav className="order-3 -mx-5 w-full px-5 sm:-mx-8 sm:px-8 md:order-2 md:mx-0 md:w-auto md:px-0" />
      </header>

      <div className="flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <div className={`mx-auto w-full ${width}`}>
          <p role="status" className="sr-only">
            Loading…
          </p>
          {children}
        </div>
      </div>
    </main>
  );
}

/** Column widths for the table bones, so the rows read as data rather than a grid. */
const COLUMN_WIDTHS = [
  "w-24",
  "w-40",
  "w-52",
  "w-20",
  "w-24",
  "w-28",
] as const;

/**
 * Placeholder for the listing pages: the search box, then rows drawn as cards
 * below `lg` and as a table from `lg` up — the same split `RecordList` makes.
 */
export function ListingSkeleton({
  search = true,
  rows = 5,
  columns = 6,
}: {
  search?: boolean;
  rows?: number;
  columns?: number;
}) {
  const bones = Array.from({ length: rows }, (_, index) => index);
  const widths = COLUMN_WIDTHS.slice(0, columns);

  return (
    <>
      {/* The real form is `mb-5 h-11 sm:h-10`; matching it keeps the list still. */}
      {search ? (
        <SkeletonBar className="mb-5 h-11 w-full rounded-lg sm:h-10" />
      ) : null}

      <ul className="flex flex-col gap-3 lg:hidden">
        {bones.map((index) => (
          <li key={index} className="reydex-card rounded-2xl p-4">
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="mt-2.5 h-4 w-2/3" />
            <SkeletonBar className="mt-2 h-3 w-1/2" />
            <div className="mt-3.5 border-t border-gold-500/10 pt-2.5">
              <SkeletonBar className="h-8 w-44 rounded-lg" />
            </div>
          </li>
        ))}
      </ul>

      <div className="reydex-card hidden rounded-2xl lg:block">
        <div className="flex items-center gap-4 border-b border-gold-500/15 px-4 py-3.5">
          {widths.map((width, index) => (
            <SkeletonBar key={index} className={`h-2.5 ${width}`} />
          ))}
        </div>

        {bones.map((index) => (
          <div
            key={index}
            className="flex items-center gap-4 border-b border-gold-500/8 px-4 py-4 last:border-0"
          >
            {widths.map((width, column) => (
              <SkeletonBar key={column} className={`h-3.5 ${width}`} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Placeholder for the create and edit pages: the page heading, then a card of
 * label-and-field pairs. `fields` is the count that fills a screen, not the
 * count the form has — this is a shape, not a preview.
 */
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <>
      <SkeletonBar className="mb-6 h-4 w-44" />

      <div className="reydex-card rounded-2xl p-6 sm:p-7">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className={index === 0 ? undefined : "mt-5"}>
            <SkeletonBar className="h-2.5 w-28" />
            <SkeletonBar className="mt-2 h-11 w-full rounded-lg sm:h-10" />
          </div>
        ))}

        <SkeletonBar className="mt-7 h-11 w-36 rounded-lg sm:h-10" />
      </div>
    </>
  );
}
