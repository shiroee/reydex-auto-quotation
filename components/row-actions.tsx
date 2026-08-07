import Link from "next/link";
import type { IconType } from "react-icons";

/**
 * The controls a listing row carries — Open, Edit, Delete — as one component, so
 * a dashboard can draw the same set twice: once in its table cell, once in the
 * card that replaces the table on a phone.
 *
 * Shared rather than repeated per dashboard mostly for the vertical padding.
 * These are the only way to act on a row, and `py-1.5` on a 12px label is what
 * makes them a thumb-sized target rather than a hairline of text; four listings
 * each writing that out by hand is four chances to leave it off.
 */

/** Where the set sits in its container: left in a card, right in a table cell. */
export type RowActionsAlign = "start" | "end";

const BASE =
  "inline-flex items-center gap-1.5 py-1.5 text-xs font-medium underline-offset-2";

/** The trigger inside `DeleteRowButton`, so it lines up with the links here. */
export const ROW_ACTION_CLASS = BASE;

export function RowActions({
  align = "start",
  children,
}: {
  align?: RowActionsAlign;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-wrap items-start gap-x-4 gap-y-0.5 ${
        align === "end" ? "justify-end" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function RowAction({
  href,
  icon: Icon,
  /** `primary` for the row's main destination; the rest stay quiet. */
  tone = "muted",
  children,
}: {
  href: string;
  icon: IconType;
  tone?: "primary" | "muted";
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${BASE} ${
        tone === "primary"
          ? "text-gold-300 hover:underline"
          : "text-gold-100/60 transition-colors hover:text-gold-100 hover:underline"
      }`}
    >
      {/* Decorative: the label beside it already names the action. */}
      <Icon aria-hidden className="size-3.5" />
      {children}
    </Link>
  );
}
