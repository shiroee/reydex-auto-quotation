#!/usr/bin/env node
/**
 * Generates the browser/app icons from the Reydex corporate mark.
 *
 *   npm run make-icons             # dragon shield only (default)
 *   npm run make-icons -- --full   # whole lockup, including the REYDEX text
 *
 * Source, in preference order:
 *   1. public/images/Logo text no outline.png  — the real corporate lockup
 *   2. public/images/Logo high res.png
 *   3. public/reydex-logo.{png,svg}
 *   4. assets/reydex-mark.svg                  — bundled vector stand-in
 *
 * Writes app/favicon.ico, app/icon.png and app/apple-icon.png, which Next.js
 * picks up automatically via the metadata file conventions — no <link> tags or
 * `metadata.icons` entries needed.
 *
 * By default the wordmark is cropped off: the lockup stacks "REYDEX" under the
 * shield and that text is unreadable at 16px. Pass --full to keep it.
 *
 * Re-run after replacing the logo; it always writes the same three paths.
 */

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Keep in step with LOGO_CANDIDATES in lib/brand.ts.
const LOGO_CANDIDATES = [
  "public/images/Logo text no outline.png",
  "public/images/Logo high res.png",
  "public/reydex-logo.png",
  "public/reydex-logo.svg",
];
const FALLBACK_SOURCE = "assets/reydex-mark.svg";

/** Sizes packed into favicon.ico — 16/32 for tabs, 48 for Windows pinning. */
const ICO_SIZES = [16, 32, 48];
/** Modern tab/PWA icon. */
const ICON_PNG_SIZE = 192;
/** iOS home-screen icon; Apple ignores transparency, so it gets a backdrop. */
const APPLE_ICON_SIZE = 180;
/** Matches --color-ink-800, so the iOS tile blends with the app surface. */
const APPLE_BACKDROP = { r: 0x17, g: 0x10, b: 0x08, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Rasterisation density for vector sources. */
const SVG_DENSITY = 384;

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function open(path) {
  return sharp(path, { density: SVG_DENSITY });
}

function resolveSource() {
  for (const candidate of LOGO_CANDIDATES) {
    if (existsSync(join(ROOT, candidate))) {
      return { path: join(ROOT, candidate), label: candidate, isRealLogo: true };
    }
  }

  const fallback = join(ROOT, FALLBACK_SOURCE);
  if (!existsSync(fallback)) {
    fail(
      `No icon source found. Expected one of ${LOGO_CANDIDATES.join(", ")} ` +
        `or ${FALLBACK_SOURCE}.`,
    );
  }

  return { path: fallback, label: FALLBACK_SOURCE, isRealLogo: false };
}

/**
 * Wraps PNGs in an ICO container. `sharp` cannot write .ico, but the format is
 * just a small directory followed by the encoded images, and PNG-compressed
 * entries are understood by every browser in current use.
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + 16 * images.length;

  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    // 0 encodes 256 in the ICO directory; our sizes are all smaller.
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size (0 = truecolour)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([
    header,
    ...entries,
    ...images.map((image) => image.data),
  ]);
}

/**
 * Finds the empty horizontal band separating the shield from the wordmark
 * beneath it, and returns the row to crop at.
 *
 * Detecting the gap from the alpha channel beats hardcoding a percentage, which
 * would silently mis-crop if the artwork is ever re-exported. Returns `null`
 * when there is no clear gap (e.g. the vector stand-in, which has no wordmark).
 */
async function findWordmarkGap(sourcePath) {
  const { data, info } = await open(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const sampled = Math.ceil(width / 2);

  // Occupancy per row: the fraction of pixels that are meaningfully opaque.
  const occupancy = new Array(height);
  for (let y = 0; y < height; y += 1) {
    let opaque = 0;
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * channels + 3] > 24) opaque += 1;
    }
    occupancy[y] = opaque / sampled;
  }

  // Longest run of near-empty rows in the lower half.
  const EMPTY = 0.02;
  let best = null;
  let runStart = null;

  for (let y = Math.floor(height * 0.5); y < height; y += 1) {
    if (occupancy[y] <= EMPTY) {
      runStart ??= y;
    } else if (runStart !== null) {
      const run = { start: runStart, end: y };
      if (!best || run.end - run.start > best.end - best.start) best = run;
      runStart = null;
    }
  }

  if (!best || best.end - best.start < Math.max(3, height * 0.005)) {
    return null;
  }

  // Content must resume below the gap, else it is just bottom padding.
  const hasContentBelow = occupancy.slice(best.end).some((value) => value > 0.05);

  return hasContentBelow ? best.start : null;
}

/** Resolves the source region to render from, cropping off the wordmark. */
async function resolveRegion(sourcePath, badgeOnly) {
  const { width, height } = await open(sourcePath).metadata();

  if (!width || !height) {
    fail("Could not read the source image dimensions.");
  }

  if (!badgeOnly) return { crop: null, width, height };

  const cutAt = await findWordmarkGap(sourcePath);

  return cutAt === null
    ? { crop: null, width, height }
    : { crop: { left: 0, top: 0, width, height: cutAt }, width, height };
}

async function renderPng(sourcePath, region, size, background) {
  let pipeline = open(sourcePath);

  if (region.crop) {
    pipeline = pipeline.extract(region.crop);
  }

  pipeline = pipeline.resize(size, size, {
    fit: "contain",
    background: background ?? TRANSPARENT,
  });

  if (background) {
    pipeline = pipeline.flatten({ background });
  }

  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const badgeOnly = !process.argv.includes("--full");
  const source = resolveSource();
  const region = await resolveRegion(source.path, badgeOnly);

  await mkdir(join(ROOT, "app"), { recursive: true });

  const icoImages = [];
  for (const size of ICO_SIZES) {
    icoImages.push({ size, data: await renderPng(source.path, region, size) });
  }

  await writeFile(join(ROOT, "app/favicon.ico"), buildIco(icoImages));
  await writeFile(
    join(ROOT, "app/icon.png"),
    await renderPng(source.path, region, ICON_PNG_SIZE),
  );
  await writeFile(
    join(ROOT, "app/apple-icon.png"),
    await renderPng(source.path, region, APPLE_ICON_SIZE, APPLE_BACKDROP),
  );

  console.log(`\n✔ Icons generated from ${source.label}`);

  if (region.crop) {
    const kept = Math.round((region.crop.height / region.height) * 100);
    console.log(`  cropped to the shield (top ${kept}% of the artwork)`);
  } else if (badgeOnly) {
    console.log("  no wordmark gap detected — used the full artwork");
  } else {
    console.log("  full lockup (--full)");
  }

  console.log(`  app/favicon.ico      ${ICO_SIZES.join("/")}px`);
  console.log(`  app/icon.png         ${ICON_PNG_SIZE}px`);
  console.log(`  app/apple-icon.png   ${APPLE_ICON_SIZE}px`);

  if (!source.isRealLogo) {
    console.log(
      "\n  Note: using the vector stand-in. Add the corporate badge under" +
        "\n  public/images/ and re-run to use the real artwork.",
    );
  }

  console.log("");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
