#!/usr/bin/env tsx
/**
 * Lifts the photographs out of a PDF service report into `public/assets`.
 *
 *   npm run extract-pdf-photos -- <file.pdf> [--prefix fdas-pm-2026-08-07]
 *
 * Kept as a script rather than run once and thrown away, because it is the only
 * record of where the images under `public/assets` came from. Re-running it on
 * the same PDF reproduces the same files in the same order.
 *
 * How it works: Word exports photographs as `/Subtype /Image` XObjects filtered
 * with `/DCTDecode`, and a DCTDecode stream *is* a JPEG file, stored verbatim.
 * So the images can be lifted by walking the object table and writing those
 * streams straight out — no inflate, no decoder, no dependency. Objects are
 * found by scanning for `N G obj` headers rather than by reading the xref table,
 * so a linearised file or one with an incremental update is handled the same.
 *
 * What it does not do: images stored as `/FlateDecode` (screenshots, diagrams,
 * anything with transparency) are skipped, because reconstructing those needs a
 * full PDF image decoder. Every photograph in the Reydex reports is DCTDecode.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const args = process.argv.slice(2);
const source = args.find((arg) => !arg.startsWith("--"));

function option(name: string): string | null {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? (args[index + 1] ?? null) : null;
}

const outDir = option("out") ?? join("public", "assets");
const prefix =
  option("prefix") ??
  basename(source ?? "photo", ".pdf")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

if (!source) {
  console.error(
    "usage: npm run extract-pdf-photos -- <file.pdf> [--prefix name] [--out dir]",
  );
  process.exit(1);
}

const pdf = readFileSync(source);
// Latin-1 keeps one byte per character, so string offsets equal byte offsets.
const text = pdf.toString("latin1");

mkdirSync(outDir, { recursive: true });

type Image = { objNo: number; width: number; height: number; bytes: Buffer };

const images: Image[] = [];
const objHeader = /(\d+)\s+(\d+)\s+obj\b/g;

let match: RegExpExecArray | null;

while ((match = objHeader.exec(text)) !== null) {
  const objNo = Number(match[1]);
  const headerEnd = match.index + match[0].length;

  const streamAt = text.indexOf("stream", headerEnd);
  if (streamAt === -1) continue;

  const dict = text.slice(headerEnd, streamAt);

  if (!/\/Subtype\s*\/Image/.test(dict)) continue;
  if (!/\/DCTDecode/.test(dict)) continue;

  // `stream` is followed by CRLF or LF, then the bytes.
  let start = streamAt + "stream".length;
  if (text[start] === "\r") start += 1;
  if (text[start] === "\n") start += 1;

  const length = Number(/\/Length\s+(\d+)/.exec(dict)?.[1] ?? "0");

  const bytes =
    length > 0
      ? pdf.subarray(start, start + length)
      : // Indirect /Length; fall back to the endstream marker.
        pdf.subarray(start, text.indexOf("endstream", start));

  // Confirm it really is a JPEG before writing it out.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) continue;

  images.push({
    objNo,
    width: Number(/\/Width\s+(\d+)/.exec(dict)?.[1] ?? "0"),
    height: Number(/\/Height\s+(\d+)/.exec(dict)?.[1] ?? "0"),
    bytes: Buffer.from(bytes),
  });
}

/*
 * Object number order, which for a Word export follows the order the images were
 * placed in the document — page by page, and left to right within a page. That
 * is what makes the output directly diallable into a report's plates, and it was
 * checked against the rendered PDF rather than assumed.
 */
images.sort((a, b) => a.objNo - b.objNo);

const seen = new Set<string>();
let written = 0;

for (const image of images) {
  /*
   * The letterhead banner is the only non-photograph in these files, and it is
   * told apart by *shape* rather than by size: it is a wide, short strip where
   * every photograph is portrait or square. A size threshold would do the wrong
   * thing — Word downsamples the photographs to about 200x290, which is smaller
   * than the banner.
   */
  if (image.width / image.height > 3) continue;

  /*
   * Word re-embeds a placed image once per *reference*, not once per file, so a
   * photograph used on a title block comes out nine times over. Deduplicating on
   * content keeps the first and drops the copies, which is what turns the raw 33
   * streams of the PM report into its 25 actual photographs.
   */
  const digest = createHash("sha1").update(image.bytes).digest("hex");

  if (seen.has(digest)) {
    console.log(`  duplicate of an earlier image — skipped (obj ${image.objNo})`);
    continue;
  }

  seen.add(digest);
  written += 1;

  const name = `${prefix}-${String(written).padStart(2, "0")}.jpg`;
  writeFileSync(join(outDir, name), image.bytes);

  console.log(
    `  ${name}  ${image.width}x${image.height}  ${(image.bytes.length / 1024).toFixed(0)}KB`,
  );
}

console.log(`\n  ${written} photo(s) written to ${outDir}\n`);
