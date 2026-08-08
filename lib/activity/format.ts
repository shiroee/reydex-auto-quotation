/**
 * Wording and time formatting for the activity log.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and used
 * from both the dashboards and the activity page — the same split the other
 * `form.ts` modules use.
 */

import { QUOTE_TIME_ZONE } from "../quotations/dates";

export const ACTION = ["create", "update", "delete"] as const;

export type ActivityAction = (typeof ACTION)[number];

export const ENTITY = [
  "quotation",
  "certificate",
  "customer",
  "item",
  "quotation_type",
  "user",
] as const;

export type ActivityEntityName = (typeof ENTITY)[number];

/** Query-string key for the activity page's entity filter. */
export const ENTITY_PARAM = "of";

/**
 * Past tense, because the log records what happened. "Added" rather than
 * "Created": it is the word the dashboards' own buttons use.
 */
export const ACTION_LABEL: Record<ActivityAction, string> = {
  create: "Added",
  update: "Edited",
  delete: "Deleted",
};

export const ENTITY_LABEL: Record<ActivityEntityName, string> = {
  quotation: "Quotation",
  certificate: "Certificate",
  customer: "Customer",
  item: "Item",
  quotation_type: "Quotation type",
  user: "User",
};

/** Plural, for the filter control. */
export const ENTITY_PLURAL: Record<ActivityEntityName, string> = {
  quotation: "Quotations",
  certificate: "Certificates",
  customer: "Customers",
  item: "Items",
  quotation_type: "Quotation types",
  user: "Users",
};

export function isActivityEntityName(
  value: unknown,
): value is ActivityEntityName {
  return (
    typeof value === "string" && (ENTITY as readonly string[]).includes(value)
  );
}

/**
 * Where the record lives now, or `null` when there is nowhere to go — a deleted
 * record, and the printable quotation for one that still exists.
 */
export function entityHref(
  entity: ActivityEntityName,
  entityId: string,
  action: ActivityAction,
): string | null {
  if (action === "delete") return null;

  switch (entity) {
    case "quotation":
      return `/quotations/${entityId}/print`;
    // Like a quotation, the printable sheet is the thing worth opening.
    case "certificate":
      return `/certificates/${entityId}/print`;
    case "customer":
      return `/customers/${entityId}/edit`;
    case "item":
      return `/items/${entityId}/edit`;
    case "quotation_type":
      return `/quotation-types/${entityId}/edit`;
    case "user":
      return `/users/${entityId}/edit`;
  }
}

/**
 * Who acted, as a name to print. Falls back to the email address, then to
 * "System" for entries with no actor at all — the seed and migration scripts
 * write records without a session.
 */
export function actorLabel(entry: {
  actorName?: string | null;
  actorEmail?: string | null;
}): string {
  const name = entry.actorName?.trim();
  if (name) return name;

  const email = entry.actorEmail?.trim();
  if (email) return email;

  return "System";
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A short "how long ago", for a table cell that has no room for a timestamp.
 *
 * Coarse on purpose: past a week the exact hour stops mattering and the date is
 * more useful, which `formatTimestamp` below gives in the tooltip. `now` is a
 * parameter rather than read from the clock so this stays testable.
 */
export function formatRelativeTime(when: Date, now: Date): string {
  const elapsed = now.getTime() - when.getTime();

  // A clock skew between the database and the server can put a write "ahead".
  if (elapsed < MINUTE) return "just now";

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return `${minutes}m ago`;
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return `${hours}h ago`;
  }

  const days = Math.floor(elapsed / DAY);
  if (days < 7) return `${days}d ago`;

  return formatDate(when);
}

/**
 * "Aug 8, 2026", in Philippine time.
 *
 * Both halves matter. `en-US` is the locale the printed quotation already uses,
 * and `QUOTE_TIME_ZONE` is what keeps a log entry on the day it happened for the
 * people reading it: the server renders in UTC, where the whole Philippine
 * morning still belongs to the previous date — the same trap `todayInQuoteZone`
 * exists to avoid.
 */
export function formatDate(when: Date): string {
  return when.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: QUOTE_TIME_ZONE,
  });
}

/** Full date and time, for the `title` behind a relative label. */
export function formatTimestamp(when: Date): string {
  return `${formatDate(when)}, ${when.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: QUOTE_TIME_ZONE,
  })}`;
}

/**
 * One line summarising an entry: "Edited by Juan Dela Cruz".
 *
 * `detail` is appended in parentheses when present, so "disabled" or
 * "password reset" reads as part of the same sentence.
 */
export function describeActivity(entry: {
  action: ActivityAction;
  detail?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
}): string {
  const detail = entry.detail?.trim();

  return (
    `${ACTION_LABEL[entry.action]} by ${actorLabel(entry)}` +
    (detail ? ` (${detail})` : "")
  );
}
