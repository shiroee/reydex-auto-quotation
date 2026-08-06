/**
 * Quotation dates.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared by the pages, the forms and the Server Actions.
 */

/**
 * Reydex operates in the Philippines, and a quotation is dated by the day it is
 * raised there — not by UTC.
 *
 * This matters: `new Date().toISOString().slice(0, 10)` is a day behind for the
 * whole Philippine morning, because 07:00 in Manila is 23:00 UTC the previous
 * day. A quotation raised before 8 a.m. would print yesterday's date.
 */
export const QUOTE_TIME_ZONE = "Asia/Manila";

/** Today where the business is, as `YYYY-MM-DD`. */
export function todayInQuoteZone(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: QUOTE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True for a real calendar date in `YYYY-MM-DD` form.
 *
 * The round-trip through `Date` is what rejects 2026-02-30: the shape check
 * alone would pass it, and Postgres would then throw on the insert.
 */
export function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/*
 * A quotation's reference embeds its year, and the sequence behind it started in
 * 2026 — so a date outside this window is a typo, not a date.
 */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export type QuoteDateResult =
  | { ok: true; date: string }
  | { ok: false; error: string };

/** Validates a date arriving from a form or a query string. */
export function parseQuoteDate(raw: unknown): QuoteDateResult {
  const value = typeof raw === "string" ? raw.trim() : "";

  if (value === "") return { ok: false, error: "Choose a date." };

  if (!isRealDate(value)) {
    return { ok: false, error: "Enter a real date (YYYY-MM-DD)." };
  }

  const year = Number(value.slice(0, 4));
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return { ok: false, error: `Enter a year between ${MIN_YEAR} and ${MAX_YEAR}.` };
  }

  return { ok: true, date: value };
}
