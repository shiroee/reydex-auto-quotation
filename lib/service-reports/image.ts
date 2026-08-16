/**
 * Identifying an uploaded photograph from its own bytes.
 *
 * Pure and free of Next.js / database imports so it can be unit tested and used
 * from both the Server Action that stores a photograph and the route that serves
 * one back.
 *
 * The reason this exists rather than trusting `File.type`: the browser sets that
 * header from the file extension, the uploader controls it outright, and we hand
 * it straight back out as a `Content-Type` on a URL under our own origin. A file
 * announced as `image/png` that is actually an HTML document would then be
 * served as a script-bearing page from the app's origin. Reading the magic bytes
 * is what makes the served `Content-Type` a statement about the file rather than
 * a repetition of what the uploader claimed.
 */

import { isPhotoMimeType, type PhotoMimeType } from "./report";

/** The signatures of the three formats `PHOTO_MIME_TYPES` allows. */
const SIGNATURES: { mime: PhotoMimeType; test: (bytes: Uint8Array) => boolean }[] =
  [
    {
      mime: "image/jpeg",
      // SOI marker, then any JPEG segment.
      test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    {
      mime: "image/png",
      test: (b) =>
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a,
    },
    {
      mime: "image/webp",
      // "RIFF" .... "WEBP" — the size field between the two is skipped.
      test: (b) =>
        b[0] === 0x52 &&
        b[1] === 0x49 &&
        b[2] === 0x46 &&
        b[3] === 0x46 &&
        b[8] === 0x57 &&
        b[9] === 0x45 &&
        b[10] === 0x42 &&
        b[11] === 0x50,
    },
  ];

/** The shortest prefix any of the tests above needs. */
const MIN_BYTES = 12;

/**
 * The format the bytes actually are, or `null` for anything that is not one of
 * the three. `null` means reject: there is no fallback to what was claimed.
 */
export function sniffImage(bytes: Uint8Array): PhotoMimeType | null {
  if (bytes.length < MIN_BYTES) return null;

  return SIGNATURES.find((signature) => signature.test(bytes))?.mime ?? null;
}

/**
 * Guards a `mime_type` read back out of the database before it is served as a
 * `Content-Type` header.
 *
 * Belt and braces: the column is only ever written from `sniffImage` above, so
 * this can only fire on a row written by hand — but the cost of being wrong is a
 * response header, and a response header is exactly the thing worth being sure
 * about. An unrecognised value falls back to a type no browser will execute.
 */
export function toServedContentType(stored: string): string {
  return isPhotoMimeType(stored) ? stored : "application/octet-stream";
}
