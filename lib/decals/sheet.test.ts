import { describe, expect, it } from "vitest";

import {
  DEFAULT_WIDTH_MM,
  MAX_WIDTH_MM,
  MIN_WIDTH_MM,
  PRINTER_MARGIN_MM,
  bestOrientation,
  clampWidth,
  decalHeight,
  planSheet,
  sheetsFor,
} from "./sheet";

describe("decalHeight", () => {
  /*
   * The reference decal, measured off the artwork the shop prints today: the
   * frame of the dry-chemical label is 141mm across and 190mm down. If this
   * drifts, every decal comes off the printer the wrong size for its cylinder.
   */
  it("gives the reference decal its measured height", () => {
    expect(decalHeight(DEFAULT_WIDTH_MM)).toBeCloseTo(190, 1);
  });

  it("scales the height with the width", () => {
    expect(decalHeight(70.5)).toBeCloseTo(95, 1);
  });
});

describe("clampWidth", () => {
  it("keeps a sensible width as it is", () => {
    expect(clampWidth(141)).toBe(141);
  });

  it("holds the ends of the range", () => {
    expect(clampWidth(5)).toBe(MIN_WIDTH_MM);
    expect(clampWidth(9000)).toBe(MAX_WIDTH_MM);
  });

  /* An emptied number field reads as NaN; it must not become a NaN-wide sheet. */
  it("falls back to the reference width when handed nothing usable", () => {
    expect(clampWidth(Number.NaN)).toBe(DEFAULT_WIDTH_MM);
  });
});

describe("planSheet", () => {
  it("fits two reference decals side by side on A4 landscape", () => {
    const plan = planSheet(DEFAULT_WIDTH_MM, "landscape");

    expect(plan.columns).toBe(2);
    expect(plan.rows).toBe(1);
    expect(plan.perSheet).toBe(2);
    // 297 - 2 x 141 = 15, so 7.5mm each side.
    expect(plan.margin.x).toBeCloseTo(7.5, 1);
    expect(plan.margin.y).toBeCloseTo(10, 1);
  });

  /*
   * The grid is fitted to the printable area, so a column the print head cannot
   * reach is never claimed. 73mm is the width that exposes it: four across is
   * 292mm, which fits on 297mm of paper but not inside the 291mm the L3250 can
   * actually put ink on.
   */
  it("never claims a column outside the printable area", () => {
    const plan = planSheet(73, "landscape");

    expect(plan.columns).toBe(3);
    expect(plan.margin.x).toBeGreaterThanOrEqual(PRINTER_MARGIN_MM);
    expect(plan.margin.y).toBeGreaterThanOrEqual(PRINTER_MARGIN_MM);
  });

  it("fits one reference decal on A4 portrait", () => {
    const plan = planSheet(DEFAULT_WIDTH_MM, "portrait");

    expect(plan.perSheet).toBe(1);
    expect(plan.fits).toBe(true);
  });

  it("packs small decals into a grid", () => {
    // 70mm wide is 94.3mm tall: two across and three down inside A4 portrait.
    const plan = planSheet(70, "portrait");

    expect(plan.columns).toBe(2);
    expect(plan.rows).toBe(3);
    expect(plan.perSheet).toBe(6);
  });

  it("leaves a gutter between decals when asked for one", () => {
    const tight = planSheet(70, "portrait", 0);
    const spaced = planSheet(70, "portrait", 10);

    expect(spaced.columns).toBeLessThanOrEqual(tight.columns);
    expect(spaced.perSheet).toBeLessThanOrEqual(tight.perSheet);
  });

  /*
   * Nothing fits, rather than a negative margin and a silently clipped sheet.
   *
   * The widest decal the clamp allows is 200 x 269.5mm: it still fits A4
   * portrait, but it is taller than a landscape sheet — so this is the case an
   * operator reaches by widening the decal while the sheet is turned sideways.
   */
  it("reports zero per sheet when the decal is taller than the sheet", () => {
    expect(decalHeight(MAX_WIDTH_MM)).toBeGreaterThan(210);

    const landscape = planSheet(MAX_WIDTH_MM, "landscape");
    expect(landscape.rows).toBe(0);
    expect(landscape.perSheet).toBe(0);
    expect(landscape.fits).toBe(false);
  });

  /*
   * The property the whole module exists to hold: every width an operator can
   * dial in has an orientation that prints, whole, inside the printable area.
   * Checked across the range rather than at a few points, because the failures
   * are narrow — 73mm was the only width that broke the earlier arrangement.
   */
  it("prints at every width in the allowed range", () => {
    for (let width = MIN_WIDTH_MM; width <= MAX_WIDTH_MM; width += 1) {
      const plan = planSheet(width, bestOrientation(width));

      expect(plan.perSheet).toBeGreaterThan(0);
      expect(plan.margin.x).toBeGreaterThanOrEqual(PRINTER_MARGIN_MM);
      expect(plan.margin.y).toBeGreaterThanOrEqual(PRINTER_MARGIN_MM);
    }
  });
});

describe("bestOrientation", () => {
  it("turns the sheet sideways for the reference decal, which doubles it up", () => {
    expect(bestOrientation(DEFAULT_WIDTH_MM)).toBe("landscape");
    expect(planSheet(DEFAULT_WIDTH_MM, "landscape").perSheet).toBe(2);
  });

  /* A decal too tall for a landscape sheet has to go on a portrait one. */
  it("stands the sheet up when the decal is too tall to lie down", () => {
    expect(bestOrientation(MAX_WIDTH_MM)).toBe("portrait");
  });
});

describe("sheetsFor", () => {
  it("counts whole sheets, rounding a part-sheet up", () => {
    expect(sheetsFor(2, 2)).toBe(1);
    expect(sheetsFor(3, 2)).toBe(2);
    expect(sheetsFor(40, 9)).toBe(5);
  });

  it("asks for nothing when there is nothing to print", () => {
    expect(sheetsFor(0, 2)).toBe(0);
    expect(sheetsFor(10, 0)).toBe(0);
  });
});
