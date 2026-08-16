/**
 * Printed wording shared by both certificates.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared by the print layout, the dashboard and the Server Actions — the same
 * split the other `lib/*` modules use.
 *
 * Dates arrive as `YYYY-MM-DD` strings, because that is what a Postgres `date`
 * column gives back, and they are taken apart as strings rather than parsed into
 * a `Date`. That is deliberate: `new Date("2026-08-07")` is midnight UTC, which
 * is still 7 a.m. of the 7th in Manila but the *6th* in any timezone west of
 * Greenwich — so a server rendering in UTC-5 would print the day before the one
 * stored. A calendar date has no timezone, and this keeps it that way.
 */

// Relative, not `@/`: this module is unit tested, and the vitest config
// resolves no path alias — see the same import in `./form.ts`.
import type { CertificateKind } from "./form";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type DateParts = { year: number; month: number; day: number };

/** `null` for anything that is not a well-formed `YYYY-MM-DD`. */
function partsOf(iso: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

/**
 * "August 7, 2026". Returns the input untouched when it is not a date, so a
 * malformed value prints as itself rather than as "Invalid Date".
 */
export function formatLongDate(iso: string): string {
  const parts = partsOf(iso);
  if (!parts) return iso;

  return `${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

/** "AUGUST 7, 2026" — the body sets the completion date in caps. */
export function formatLongDateUpper(iso: string): string {
  return formatLongDate(iso).toUpperCase();
}

/** "August 2026", for the issue line, where the day is printed separately. */
export function formatMonthYear(iso: string): string {
  const parts = partsOf(iso);
  if (!parts) return iso;

  return `${MONTHS[parts.month - 1]} ${parts.year}`;
}

/**
 * The English ordinal suffix for a day of the month: 1st, 2nd, 3rd, 4th …
 *
 * The 11–13 case is the one worth spelling out — they take "th" despite ending
 * in 1, 2 and 3, which is why this is not a lookup on the last digit alone.
 */
export function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export type IssuedOn = { day: number; suffix: string; monthYear: string };

/**
 * The pieces of "Issued this 6TH day of August 2026", kept apart so the layout
 * can set the suffix as a superscript the way the original Word document does.
 * `null` when the date is unusable, so the caller can drop the sentence rather
 * than print a broken one.
 */
export function issuedOn(iso: string): IssuedOn | null {
  const parts = partsOf(iso);
  if (!parts) return null;

  return {
    day: parts.day,
    suffix: ordinalSuffix(parts.day),
    monthYear: formatMonthYear(iso),
  };
}

/**
 * Which document a row is, for the dashboard.
 *
 * Short and parallel rather than the full titles: these are read in a table
 * cell beside a reference number that already carries half the answer, so
 * "Completion" next to RDX-COC-2026-0001 says everything "Certificate of
 * completion" would, in a cell that does not wrap.
 */
export function certificateKindLabel(kind: CertificateKind): string {
  return kind === "safety_reliability" ? "Safety & reliability" : "Completion";
}

/**
 * The date each kind hangs its story on, as a column heading: one certifies
 * that works were *completed*, the other that a system was *tested*.
 */
export function completionDateLabel(kind: CertificateKind): string {
  return kind === "safety_reliability" ? "Tested" : "Completed";
}

/**
 * The lead-in of the saved filename — see `lib/documents/filename.ts`, where
 * the reasoning for putting the kind first is spelled out. Two documents for the
 * same client land side by side in a folder and have to be told apart there.
 */
export function certificateFilePrefix(kind: CertificateKind): string {
  return kind === "safety_reliability" ? "Reydex CSR" : "Reydex COC";
}
