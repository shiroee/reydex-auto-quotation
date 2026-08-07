import Link from "next/link";
import { Fragment } from "react";

/**
 * The phone view of a listing dashboard.
 *
 * A five-to-seven column table has nowhere to go on a 375px screen. Left alone
 * it pushes the card it sits in past the viewport and takes the whole page
 * sideways with it; clipped, the last columns — which is where Edit and Delete
 * live — simply cannot be reached. So below `md` each row is drawn again as a
 * card, with the columns as labelled facts: the same information, read down the
 * screen instead of across it.
 *
 * Both views render from the same row, and this file only lays them out — which
 * fields a dashboard shows, and in what order, stays with that dashboard.
 */

export type RecordFact = {
  label: string;
  /** A node, so a fact can carry a link or a second, quieter line. */
  value: React.ReactNode;
  /** For the figure the row is really about: its total, its price. */
  strong?: boolean;
};

/** Hidden from `md` up, where the table takes over. */
export function RecordList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col gap-3 md:hidden">{children}</ul>;
}

export function RecordCard({
  eyebrow,
  title,
  href,
  badge,
  subtitle,
  facts,
  actions,
}: {
  /** Quiet monospaced line above the title: a reference number, a SKU, a slug. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Makes the title the row's primary link, as it is in the table. */
  href?: string;
  badge?: React.ReactNode;
  subtitle?: React.ReactNode;
  facts: RecordFact[];
  actions: React.ReactNode;
}) {
  return (
    <li className="reydex-card rounded-2xl p-4">
      {eyebrow ? (
        <p className="font-mono text-xs text-gold-200">{eyebrow}</p>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h2 className="text-[0.95rem] font-semibold leading-snug text-gold-100/90">
          {href ? (
            <Link href={href} className="underline-offset-2 hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        {badge}
      </div>

      {/*
       * Not clamped, unlike the table cell: a phone has the vertical room the
       * table has no horizontal room for, and a subject the reader cannot finish
       * is the thing the truncation was working around in the first place.
       */}
      {subtitle ? (
        <p className="mt-1 text-sm leading-snug text-gold-100/60">{subtitle}</p>
      ) : null}

      {/* `dt`/`dd` pairs placed straight into the grid — two columns, one row each. */}
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
        {facts.map((fact) => (
          <Fragment key={fact.label}>
            <dt className="pt-px text-xs uppercase tracking-wider text-gold-100/40">
              {fact.label}
            </dt>
            <dd
              className={
                fact.strong
                  ? "text-sm font-semibold tabular-nums text-gold-100/90"
                  : "text-sm text-gold-100/60"
              }
            >
              {fact.value}
            </dd>
          </Fragment>
        ))}
      </dl>

      <div className="mt-3.5 border-t border-gold-500/10 pt-2.5">{actions}</div>
    </li>
  );
}
