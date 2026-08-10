"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { DecalArtwork, type DecalFill } from "@/components/decals/decal";
import type { Decal } from "@/lib/decals/catalogue";
import {
  DEFAULT_WIDTH_MM,
  MAX_WIDTH_MM,
  MIN_WIDTH_MM,
  PRINTER_MARGIN_MM,
  SIZE_PRESETS,
  bestOrientation,
  clampWidth,
  planSheet,
  sheetsFor,
  type Orientation,
} from "@/lib/decals/sheet";

/**
 * The printable sheet, with its controls.
 *
 * A client component holding its own state rather than a form that reloads the
 * page: every control here changes the drawing, and an operator sizing a decal
 * against a cylinder in front of them is going to move the slider more than
 * once. Nothing is saved — a decal has no record to keep, only a sheet to print.
 *
 * The controls are inside the printed document and hidden by `@media print`,
 * which is how the quotation and certificate sheets work too.
 */
export function PrintSheet({ decal }: { decal: Decal }) {
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM);
  const [copies, setCopies] = useState(2);
  const [fill, setFill] = useState<DecalFill>({});
  /** `null` until the operator picks one, so it can track the width. */
  const [chosenOrientation, setChosenOrientation] =
    useState<Orientation | null>(null);

  const fieldId = useId();

  const orientation = chosenOrientation ?? bestOrientation(widthMm);
  const plan = useMemo(
    () => planSheet(widthMm, orientation),
    [widthMm, orientation],
  );

  const sheets = sheetsFor(copies, plan.perSheet);
  const onLastSheet = plan.perSheet
    ? copies - (sheets - 1) * plan.perSheet
    : 0;

  /*
   * Every decal to draw, as a flat list chopped into sheets. The last sheet is
   * short unless the run divides evenly — printing a full final sheet would
   * quietly hand back more labels than were asked for, and these get stuck on
   * cylinders.
   */
  const pages = useMemo(() => {
    if (plan.perSheet <= 0) return [];
    return Array.from({ length: sheets }, (_, sheet) =>
      Math.min(plan.perSheet, copies - sheet * plan.perSheet),
    );
  }, [copies, plan.perSheet, sheets]);

  const update = (patch: Partial<DecalFill>) =>
    setFill((current) => ({ ...current, ...patch }));

  return (
    <div
      className="ds-page ds-fit"
      style={
        {
          "--ds-sheet-w": `${plan.sheet.width}mm`,
          "--ds-sheet-h": `${plan.sheet.height}mm`,
          "--ds-cols": plan.columns,
          "--ds-decal-w": `${plan.decal.width}mm`,
          "--ds-margin-x": `${plan.margin.x}mm`,
          "--ds-margin-y": `${plan.margin.y}mm`,
        } as React.CSSProperties
      }
    >
      {/*
       * `@page` cannot be set from an inline style — it is not attached to an
       * element — so the one rule that has to follow the chosen orientation is
       * written out here. Without it the browser prints A4 portrait and a
       * landscape sheet arrives sideways and clipped.
       */}
      <style>{`@page { size: A4 ${orientation}; margin: 0; }`}</style>

      <div className="ds-toolbar">
        <label className="ds-control ds-control-narrow" htmlFor={`${fieldId}-size`}>
          Decal size
          <select
            id={`${fieldId}-size`}
            value={widthMm}
            onChange={(event) => setWidthMm(Number(event.target.value))}
          >
            {SIZE_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.widthMm}>
                {preset.label} — {preset.widthMm}mm
              </option>
            ))}
            {SIZE_PRESETS.every((preset) => preset.widthMm !== widthMm) ? (
              <option value={widthMm}>Custom — {widthMm}mm</option>
            ) : null}
          </select>
        </label>

        <label className="ds-control ds-control-narrow" htmlFor={`${fieldId}-width`}>
          Width (mm)
          <input
            id={`${fieldId}-width`}
            type="number"
            min={MIN_WIDTH_MM}
            max={MAX_WIDTH_MM}
            step={1}
            value={widthMm}
            onChange={(event) =>
              setWidthMm(clampWidth(Number(event.target.value)))
            }
          />
        </label>

        <label className="ds-control ds-control-narrow" htmlFor={`${fieldId}-orient`}>
          Sheet
          <select
            id={`${fieldId}-orient`}
            value={orientation}
            onChange={(event) =>
              setChosenOrientation(event.target.value as Orientation)
            }
          >
            <option value="landscape">A4 landscape</option>
            <option value="portrait">A4 portrait</option>
          </select>
        </label>

        <label className="ds-control ds-control-narrow" htmlFor={`${fieldId}-copies`}>
          Copies
          <input
            id={`${fieldId}-copies`}
            type="number"
            min={1}
            max={200}
            step={1}
            value={copies}
            onChange={(event) =>
              setCopies(
                Math.min(200, Math.max(1, Math.round(Number(event.target.value) || 1))),
              )
            }
          />
        </label>

        <label className="ds-control ds-control-narrow" htmlFor={`${fieldId}-capacity`}>
          Capacity
          <input
            id={`${fieldId}-capacity`}
            type="text"
            inputMode="decimal"
            placeholder="blank"
            value={fill.capacity ?? ""}
            onChange={(event) => update({ capacity: event.target.value })}
          />
        </label>

        <label className="ds-control ds-control-narrow" htmlFor={`${fieldId}-weight`}>
          Full weight
          <input
            id={`${fieldId}-weight`}
            type="text"
            inputMode="decimal"
            placeholder="blank"
            value={fill.fullWeight ?? ""}
            onChange={(event) => update({ fullWeight: event.target.value })}
          />
        </label>

        <div className="ds-actions">
          <Link href="/decals" className="ds-back-link">
            All decals
          </Link>
          <button
            type="button"
            className="ds-print-button"
            disabled={plan.perSheet === 0}
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      {plan.fits ? (
        <p className="ds-note" role="status">
          <strong>
            {plan.perSheet} per sheet · {sheets}{" "}
            {sheets === 1 ? "sheet" : "sheets"} for {copies}{" "}
            {copies === 1 ? "decal" : "decals"}
            {sheets > 1 && onLastSheet !== plan.perSheet
              ? ` (last sheet holds ${onLastSheet})`
              : ""}
            .
          </strong>{" "}
          In the print dialog set <strong>Margins: None</strong> and{" "}
          <strong>Scale: 100%</strong> — on any other setting the browser shrinks
          the sheet to fit and the decal comes out undersized. The grid already
          keeps {PRINTER_MARGIN_MM}mm clear of every edge for the printer.
        </p>
      ) : (
        <p className="ds-note ds-warn" role="status">
          <strong>Too big for this sheet.</strong> A {plan.decal.width}×
          {plan.decal.height}mm decal does not fit on A4 {plan.orientation} once
          the printer&rsquo;s {PRINTER_MARGIN_MM}mm edge is allowed for. Turn the
          sheet the other way, or reduce the width.
        </p>
      )}

      {pages.map((count, sheet) => (
        <div className="ds-sheet" key={sheet}>
          {Array.from({ length: count }, (_, index) => (
            <DecalArtwork
              key={index}
              decal={decal}
              widthMm={plan.decal.width}
              fill={fill}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
