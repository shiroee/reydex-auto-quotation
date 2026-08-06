/**
 * Search-term handling for the quotations index.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared: the page normalises `?q=` with it, the service turns the result into
 * an `ILIKE` pattern.
 */

/** Query-string key for the search box. */
export const SEARCH_PARAM = "q";

/** Longer than any reference number, customer name or subject worth typing. */
const MAX_SEARCH_LENGTH = 120;

/**
 * Collapses a raw `?q=` value into the term to search for. `""` means
 * "no filter", so a blank or whitespace-only box lists everything.
 *
 * `searchParams` yields an array when the key repeats (`?q=a&q=b`), so the first
 * value wins rather than the page failing on a non-string.
 */
export function normalizeSearch(
  raw: string | string[] | undefined | null,
): string {
  const first = Array.isArray(raw) ? raw[0] : raw;

  return (first ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

/**
 * Wraps a term as a Postgres `LIKE`/`ILIKE` pattern matching anywhere in the
 * value.
 *
 * The term is escaped first. It travels as a bound parameter, so it cannot
 * inject SQL, but `%` and `_` typed into the box would still be read as
 * wildcards, and a trailing backslash would leave the pattern invalid.
 */
export function toContainsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}
