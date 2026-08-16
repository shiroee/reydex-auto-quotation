import "server-only";

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const COMPANY_NAME = "Reydex Fire Extinguisher Trading";
export const COMPANY_SHORT_NAME = "Reydex";
export const APP_NAME = "Reydex Quotations";

export type BrandImage = {
  /** URL-encoded path, ready to hand to `next/image`. */
  src: string;
  /** Intrinsic pixel dimensions, so the asset is never stretched. */
  width: number;
  height: number;
};

/** Kept as an alias: the mark component was written against this name. */
export type BrandLogo = BrandImage;

/**
 * Candidate logo files, in preference order.
 *
 * "Logo text no outline" wins: it is cropped tight to the artwork and its
 * transparent pixels are clean black, so it composites onto a page without a
 * halo. "Logo high res" is the same lockup but padded and carries a leftover
 * olive gradient in its fully-transparent pixels.
 */
const LOGO_CANDIDATES = [
  "images/Logo text no outline.png",
  "images/Logo high res.png",
  "reydex-logo.png",
  "reydex-logo.svg",
] as const;

/** Scanned signature, printed above the name rule on quotations. */
const SIGNATURE_CANDIDATES = [
  "images/signature.png",
  "images/signature.svg",
  "signature.png",
] as const;

/**
 * The signature of the engineer who certifies a fire protection system as safe
 * and reliable — a different hand from the one above, because that document is
 * signed in a professional capacity rather than a company one.
 *
 * Named for the role, not the person: when the practice's Registered Mechanical
 * Engineer changes, this file is replaced. The catch worth knowing is that there
 * is one slot rather than one per engineer, so a certificate naming somebody
 * else in `signatory_name` would still print the scan sitting here. That is the
 * same bargain the company signature above already makes.
 */
const ENGINEER_SIGNATURE_CANDIDATES = [
  "images/signature-engineer.png",
  "images/signature-engineer.svg",
] as const;

/** Reads intrinsic dimensions straight from the PNG IHDR chunk. */
function readPngSize(path: string): { width: number; height: number } | null {
  const header = Buffer.alloc(24);

  try {
    const file = readFileSync(path);
    if (file.length < 24) return null;
    file.copy(header, 0, 0, 24);
  } catch {
    return null;
  }

  // 8-byte signature, then a length + "IHDR" tag, then width/height as BE u32.
  if (header.toString("ascii", 12, 16) !== "IHDR") return null;

  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);

  return width > 0 && height > 0 ? { width, height } : null;
}

/** Pulls dimensions from an SVG's explicit size, else its viewBox. */
function readSvgSize(path: string): { width: number; height: number } | null {
  let markup: string;

  try {
    markup = readFileSync(path, "utf8").slice(0, 2048);
  } catch {
    return null;
  }

  const width = markup.match(/\bwidth="([\d.]+)/)?.[1];
  const height = markup.match(/\bheight="([\d.]+)/)?.[1];

  if (width && height) {
    return { width: Number(width), height: Number(height) };
  }

  const viewBox = markup
    .match(/viewBox="([^"]+)"/)?.[1]
    ?.trim()
    .split(/[\s,]+/);

  if (viewBox?.length === 4) {
    return { width: Number(viewBox[2]), height: Number(viewBox[3]) };
  }

  return null;
}

/** First candidate under `public/` that exists and whose size can be read. */
function resolveBrandImage(candidates: readonly string[]): BrandImage | null {
  for (const candidate of candidates) {
    const path = join(process.cwd(), "public", candidate);
    if (!existsSync(path)) continue;

    const size = candidate.endsWith(".svg")
      ? readSvgSize(path)
      : readPngSize(path);

    if (!size) continue;

    return {
      // Filenames may contain spaces; encode per segment so the leading
      // slashes survive.
      src: `/${candidate.split("/").map(encodeURIComponent).join("/")}`,
      ...size,
    };
  }

  return null;
}

/*
 * Resolved once at module load — `public/` is immutable at runtime, so there is
 * no reason to hit the filesystem per request.
 */
export const brandLogo: BrandImage | null = resolveBrandImage(LOGO_CANDIDATES);
export const signatureImage: BrandImage | null =
  resolveBrandImage(SIGNATURE_CANDIDATES);
export const engineerSignatureImage: BrandImage | null = resolveBrandImage(
  ENGINEER_SIGNATURE_CANDIDATES,
);
