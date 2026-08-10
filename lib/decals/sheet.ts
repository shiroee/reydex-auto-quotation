/*
 * How many decals fit on a sheet, and whether the result will actually come out
 * of the printer whole.
 *
 * The reason this is arithmetic rather than a fixed layout: a decal is sized to
 * the cylinder it wraps, so a 1 kg unit and a 50 lb unit do not take the same
 * label. The operator sets a width, and everything else — the height, the grid,
 * the margins, whether it still clears the printer's unprintable edge — follows
 * from it.
 *
 * Pure, and unit tested: getting this wrong prints a wasted sheet, and the way
 * it is wrong (a decal 3 mm short) is not obvious until one is held against a
 * cylinder.
 */

/** A4, the only paper the shop prints decals on. */
export const PAPER = { width: 210, height: 297 } as const;

/**
 * The reference decal, measured off the artwork Reydex prints today: the black
 * frame of the dry-chemical decal is 141 mm across and 190 mm down.
 */
export const DEFAULT_WIDTH_MM = 141;
export const DECAL_ASPECT = 190 / 141;

/** Sizes an operator can pick without typing a number. */
export const SIZE_PRESETS = [
  { label: "Standard", widthMm: 141, note: "as printed today — 10 lb and up" },
  { label: "Small", widthMm: 118, note: "1–3 kg cylinders" },
  { label: "Large", widthMm: 160, note: "50 lb and cart units" },
] as const;

/** The band a width must stay inside to be worth printing. */
export const MIN_WIDTH_MM = 70;
export const MAX_WIDTH_MM = 200;

/**
 * Widest unprintable edge on the shop's Epson L3250. Epson quotes 3 mm on all
 * four sides for plain A4; anything inside that is not reached by the head, so a
 * layout that needs it silently comes out scaled down or clipped.
 */
export const PRINTER_MARGIN_MM = 3;

export type Orientation = "portrait" | "landscape";

export type SheetPlan = {
  orientation: Orientation;
  /** Sheet dimensions in the chosen orientation. */
  sheet: { width: number; height: number };
  decal: { width: number; height: number };
  columns: number;
  rows: number;
  /** Decals on one sheet. Zero when even one will not fit. */
  perSheet: number;
  /** Even margin left around the block once the grid is centred. */
  margin: { x: number; y: number };
  /** True when at least one decal fits inside the printable area. */
  fits: boolean;
};

export function decalHeight(widthMm: number): number {
  return round(widthMm * DECAL_ASPECT);
}

export function clampWidth(widthMm: number): number {
  if (!Number.isFinite(widthMm)) return DEFAULT_WIDTH_MM;
  return Math.min(MAX_WIDTH_MM, Math.max(MIN_WIDTH_MM, Math.round(widthMm)));
}

/**
 * Lay a grid of decals out on A4 in one orientation.
 *
 * The grid is fitted to the **printable** area — the sheet less the printer's
 * unprintable edge on each side — not to the paper. Packing to the paper edge
 * would sometimes win a column that the head cannot actually reach, and the way
 * that fails is a row of decals with their frames shaved off, discovered after
 * the sheet is printed. A column given up here costs a little paper; the other
 * way costs the run.
 *
 * The gap between decals is deliberately zero: they are cut apart with a
 * guillotine along the frame, so a gutter would only cost sheet area. `gapMm`
 * exists for the caller that wants crop room, not as a default.
 */
export function planSheet(
  widthMm: number,
  orientation: Orientation,
  gapMm = 0,
): SheetPlan {
  const width = clampWidth(widthMm);
  const height = decalHeight(width);

  const sheet =
    orientation === "landscape"
      ? { width: PAPER.height, height: PAPER.width }
      : { width: PAPER.width, height: PAPER.height };

  const printable = {
    width: sheet.width - 2 * PRINTER_MARGIN_MM,
    height: sheet.height - 2 * PRINTER_MARGIN_MM,
  };

  const columns = fitCount(printable.width, width, gapMm);
  const rows = fitCount(printable.height, height, gapMm);

  const blockWidth = columns * width + Math.max(0, columns - 1) * gapMm;
  const blockHeight = rows * height + Math.max(0, rows - 1) * gapMm;

  // Centred on the paper, so the unused printable margin is shared evenly.
  const margin = {
    x: round((sheet.width - blockWidth) / 2),
    y: round((sheet.height - blockHeight) / 2),
  };

  const perSheet = columns * rows;

  return {
    orientation,
    sheet,
    decal: { width, height },
    columns,
    rows,
    perSheet,
    margin,
    fits: perSheet > 0,
  };
}

/**
 * The orientation that fits the most decals on a sheet.
 *
 * Ties go to portrait, which is the way paper goes into the tray.
 */
export function bestOrientation(widthMm: number, gapMm = 0): Orientation {
  const portrait = planSheet(widthMm, "portrait", gapMm);
  const landscape = planSheet(widthMm, "landscape", gapMm);

  return landscape.perSheet > portrait.perSheet ? "landscape" : "portrait";
}

/** How many sheets a run of `copies` decals takes, and how the last one fills. */
export function sheetsFor(copies: number, perSheet: number): number {
  if (perSheet <= 0 || copies <= 0) return 0;
  return Math.ceil(copies / perSheet);
}

/** How many whole decals fit along one edge. */
function fitCount(available: number, size: number, gap: number): number {
  if (size <= 0) return 0;
  // n * size + (n - 1) * gap <= available
  const n = Math.floor((available + gap) / (size + gap));
  return Math.max(0, n);
}

/** Two decimal places — millimetres, not micrometres. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}
