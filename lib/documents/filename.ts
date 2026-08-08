/**
 * The name a generated document saves under.
 *
 * There is no API for setting the filename of a browser print: Chrome, Edge and
 * Firefox all seed the Save-as-PDF dialog from `document.title`, so the title is
 * the filename, and building one is building the other. That is also the catch
 * worth knowing — the browser tab reads the same way, because it is the same
 * string.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and
 * shared by both printable routes.
 */

/**
 * Characters Windows forbids in a filename, plus the C0 control range.
 *
 * Browsers do sanitise what they are given, but they disagree about how — one
 * drops the character, another substitutes an underscore — so a client called
 * "SHOPPER SAVERS / SUBIC" would save under a different name depending on who
 * printed it. Normalising here means one predictable answer.
 *
 * The hyphen and the space are deliberately absent from this class:
 * "RDX-COC-2026-0001" has to survive intact, since it is what the folder gets
 * searched by.
 */
const ILLEGAL = new RegExp('[<>:"/\\\\|?*\\u0000-\\u001f]', "g");

/** Whitespace runs, including whatever the substitution above left behind. */
const SPACES = /\s+/g;

/**
 * Trailing dots and spaces, which Windows silently strips from a filename —
 * leaving a file whose name no longer matches what the dialog offered.
 */
const TRAILING = /[\s.]+$/;

function clean(value: string): string {
  return value.replace(ILLEGAL, " ").replace(SPACES, " ").trim();
}

/**
 * "Reydex COC RDX-COC-2026-0001 - SHOPPER SAVERS".
 *
 * The kind of document leads, so a folder of saved PDFs groups by kind and then
 * sorts by reference within it — which is how they get looked for. A plain
 * hyphen separates the party rather than an em dash: the dash survives every
 * browser, but it is a nuisance to type when searching for the file later.
 *
 * `party` may be blank — a quotation whose customer row has gone — in which case
 * the name is just the prefix and the reference.
 */
export function documentFileName(
  prefix: string,
  reference: string,
  party: string,
): string {
  const name = [clean(prefix), clean(reference)].filter(Boolean).join(" ");
  const suffix = clean(party);

  return (suffix ? `${name} - ${suffix}` : name).replace(TRAILING, "");
}
