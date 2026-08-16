/**
 * Printed and dashboard wording for service reports.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared by the print layout, the dashboard and the Server Actions.
 *
 * `formatLongDate` is imported from the certificates rather than reimplemented.
 * It is generic calendar-date formatting that happens to live there first, and
 * the reasoning it carries — that `YYYY-MM-DD` is taken apart as a string,
 * because `new Date("2026-08-07")` is the 6th anywhere west of Greenwich — has
 * to hold identically for every document this app prints. Two copies would be
 * two chances for one document to print the day before another.
 */

// Relative, not `@/`: this module is unit tested, and the vitest config
// resolves no path alias — see the same import in `lib/activity/format.ts`.
import { formatLongDate } from "../certificates/format";
import {
  CHECKLIST_ITEMS,
  type ServiceReportChecklist,
  type ServiceReportKind,
} from "./report";

export { formatLongDate };

/**
 * How the checklist came out, as one line for a table cell: "11 pass · 2 to
 * service · 13 checked".
 *
 * The unanswered count is the one worth having on the dashboard. A report that
 * has been printed and handed over with items left unmarked is a report that
 * was filled in in a hurry, and the list is the only place that is visible
 * without opening every sheet.
 */
export type ChecklistTally = {
  pass: number;
  service: number;
  na: number;
  /** Items with no mark at all — thirteen minus the three above. */
  unmarked: number;
  total: number;
};

export function tallyChecklist(
  checklist: ServiceReportChecklist,
): ChecklistTally {
  const tally: ChecklistTally = {
    pass: 0,
    service: 0,
    na: 0,
    unmarked: 0,
    total: CHECKLIST_ITEMS.length,
  };

  // Driven by the item list rather than by the map's own keys, so a retired key
  // left behind in `jsonb` cannot be counted as an answer to a live question.
  for (const item of CHECKLIST_ITEMS) {
    const mark = checklist[item.key];

    if (mark === undefined) tally.unmarked += 1;
    else tally[mark] += 1;
  }

  return tally;
}

/**
 * The tally as a short sentence. Only the parts that are non-zero, so the common
 * case — everything passed — reads as "13 pass" rather than as four counts, three
 * of which are zero.
 */
export function describeTally(tally: ChecklistTally): string {
  const parts: string[] = [];

  if (tally.pass) parts.push(`${tally.pass} pass`);
  if (tally.service) parts.push(`${tally.service} to service`);
  if (tally.na) parts.push(`${tally.na} n/a`);
  if (tally.unmarked) parts.push(`${tally.unmarked} unmarked`);

  return parts.join(" · ") || "Not started";
}

/**
 * The lead-in of the saved filename — see `lib/documents/filename.ts`, where the
 * reasoning for putting the kind of document first is spelled out. Two reports
 * for the same visit land side by side in a folder and have to be told apart
 * there, so the kind leads.
 */
export function serviceReportFilePrefix(kind: ServiceReportKind): string {
  return kind === "photo_report" ? "Reydex FDAS PM Report" : "Reydex FDAS Report";
}
