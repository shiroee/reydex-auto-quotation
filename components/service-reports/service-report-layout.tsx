import Image from "next/image";

import type { CompanyProfile } from "@/db";
import type { BrandImage } from "@/lib/brand";
import { formatLongDate } from "@/lib/service-reports/format";
import {
  CHECKLIST_GROUPS,
  MARK_GLYPH,
  PANEL_TYPES,
  PANEL_TYPE_LABEL,
  type ChecklistItem,
  type ServiceReportChecklist,
} from "@/lib/service-reports/report";
import type { ServiceReportRecord } from "@/lib/service-reports/service";

/** Printed width of the signature scan, as on the certificates. */
const SIGNATURE_WIDTH_MM = 34;

/**
 * The FDAS maintenance report, laid out as the original Excel sheet.
 *
 * Unlike the certificates this is a *form* rather than a letter: five
 * particulars at the head, then four bordered tables — what was serviced, how
 * the panel scored, what was done and found, and what is recommended — and two
 * signature blocks. So it is built from real `<table>`s throughout, which is
 * also what lets it fragment properly if a long list of findings pushes it onto
 * a second page.
 *
 * As with the certificates, the fixed wording is here rather than in the
 * database: the thirteen checklist questions and the legend under them come from
 * `lib/service-reports/report.ts`, and the record supplies only the marks and
 * the rows that vary per visit.
 */
export function ServiceReportLayout({
  report,
  profile,
  signature,
}: {
  report: ServiceReportRecord;
  profile: CompanyProfile | undefined;
  signature: BrandImage | null;
}) {
  const servicedBy =
    report.servicedByName?.trim() || profile?.signatoryName || "";
  const servicedByTitle = report.servicedByTitle?.trim() || "";

  return (
    <div className="q-sr">
      {/*
       * The particulars. A table rather than a definition list so the values
       * line up under each other and each carries the ruled baseline the
       * original writes them on.
       */}
      <table className="q-sr-particulars">
        <tbody>
          <Particular label="Customer" value={report.customerName} />
          <Particular label="Address" value={report.address} />
          <Particular label="Project" value={report.projectTitle} />
          {/* Nullable since the photo report shares this table and has no
              System line; this layout only ever draws a checklist report, so a
              null here means a row edited outside the form. */}
          <Particular label="System" value={report.systemDescription ?? ""} />
          <Particular
            label="Date"
            value={formatLongDate(report.serviceDate)}
          />
        </tbody>
      </table>

      <h2 className="q-sr-banner">FDAS MAINTENANCE REPORT</h2>

      <p className="q-sr-lead">
        Below is the list of equipment and devices installed in the following
        areas subject for operational testing:
      </p>

      <EquipmentTable report={report} />

      <h2 className="q-sr-banner">COMPONENT CHECKLIST</h2>

      {CHECKLIST_GROUPS.map((group) => (
        <ChecklistTable
          key={group.title}
          title={group.title}
          items={group.items}
          checklist={report.checklist}
        />
      ))}

      <p className="q-sr-legend">
        <span className="q-sr-glyph">√</span> - Passes Inspection{" "}
        <span className="q-sr-glyph">X</span> - Requires Service{" "}
        <span className="q-sr-glyph">NA</span> - Not Applicable
      </p>

      <FindingsTable lines={report.lines} />

      {report.recommendations.length > 0 ? (
        <table className="q-sr-table q-sr-recommendations">
          <thead>
            <tr>
              <th className="q-sr-caption">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {report.recommendations.map((recommendation, index) => (
              <tr key={index}>
                <td>{recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <div className="q-sr-signatures">
        <div className="q-sr-signature">
          <p className="q-sr-sig-label">Serviced by:</p>

          <div className="q-sig-mark">
            {signature ? <SignatureScan signature={signature} /> : null}
          </div>

          <p className="q-sr-sig-name">{servicedBy}</p>
          {servicedByTitle ? (
            <p className="q-sr-sig-title">{servicedByTitle}</p>
          ) : null}
          <p className="q-sr-sig-caption">
            <span className="q-strong">REYDEX&apos;s</span> Representative/s
          </p>
        </div>

        {/*
         * Left blank unless a name was recorded: this block is signed by hand on
         * site, and the rule is what it is signed on.
         */}
        <div className="q-sr-signature">
          <p className="q-sr-sig-label">Noted by Owner or Representative:</p>

          <div className="q-sig-mark" />

          <p className="q-sr-sig-name">{report.notedByName ?? ""}</p>
          <p className="q-sr-sig-caption">Printed Name &amp; Signature</p>
        </div>
      </div>
    </div>
  );
}

function Particular({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th>{label}:</th>
      <td>{value}</td>
    </tr>
  );
}

/**
 * "Equipment Serviced" — the model and brand of the panel, where it covers, and
 * how many of each device hang off it. The header spans two rows because Model
 * and Brand sit *under* one "Equipment Serviced" heading on the original, while
 * the other four columns run the full height.
 *
 * The Others row and the Addressable/Conventional row are part of the same
 * table on the sheet, so they are part of it here.
 */
function EquipmentTable({ report }: { report: ServiceReportRecord }) {
  return (
    <table className="q-sr-table q-sr-equipment">
      {/*
       * Column widths have to come from a `colgroup` rather than from `width` on
       * the header cells. `table-layout: fixed` sizes the columns from the first
       * row, and this table's first row leads with a cell spanning Model and
       * Brand — so neither of those columns is ever given a width by it, and the
       * browser squeezes them until a part number wraps to three lines.
       */}
      <colgroup>
        <col className="q-sr-col-model" />
        <col className="q-sr-col-model" />
        <col className="q-sr-col-location" />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={2}>Equipment Serviced</th>
          <th rowSpan={2}>Location</th>
          <th rowSpan={2}>No. Detector</th>
          <th rowSpan={2}>No. Manual Pull</th>
          <th rowSpan={2}>No. Bell/Horn Strobe</th>
        </tr>
        <tr>
          <th>Model</th>
          <th>Brand</th>
        </tr>
      </thead>
      <tbody>
        {report.equipment.length > 0 ? (
          report.equipment.map((row, index) => (
            <tr key={index}>
              <td className="q-strong">{row.model}</td>
              <td className="q-strong">{row.brand}</td>
              <td className="q-strong">{row.location}</td>
              <td className="q-strong">{row.detectors}</td>
              <td className="q-strong">{row.manualPulls}</td>
              <td className="q-strong">{row.bellsStrobes}</td>
            </tr>
          ))
        ) : (
          // An empty row rather than a collapsed table: the sheet is a form, and
          // a form with a missing table reads as a printing fault.
          <tr>
            <td colSpan={6} />
          </tr>
        )}

        <tr>
          <th className="q-sr-row-label" colSpan={2}>
            Others
          </th>
          <td colSpan={4}>{report.otherEquipment ?? ""}</td>
        </tr>

        {/*
         * The panel architecture, drawn as the original does: both words are
         * printed and the one that applies is ticked, so the sheet says what was
         * considered as well as what was found.
         */}
        {PANEL_TYPES.map((type) => (
          <tr key={type}>
            <th className="q-sr-row-label" colSpan={2}>
              {PANEL_TYPE_LABEL[type]}
            </th>
            <td className="q-sr-tick" colSpan={4}>
              {report.panelType === type ? MARK_GLYPH.pass : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One of the two fixed checklists.
 *
 * An item with no mark prints an empty cell rather than a glyph — see
 * `ServiceReportChecklist`, where the reasoning is set out: a default of "passes
 * inspection" would have the sheet assert that something was tested and found
 * sound when nobody looked at it.
 */
function ChecklistTable({
  title,
  items,
  checklist,
}: {
  title: string;
  items: readonly ChecklistItem[];
  checklist: ServiceReportChecklist;
}) {
  return (
    <table className="q-sr-table q-sr-checklist">
      {/* Same reason as the equipment table: the first row is the caption, which
          spans all three columns and so sizes none of them. */}
      <colgroup>
        <col className="q-sr-col-check-label" />
        <col />
        <col className="q-sr-col-tick" />
      </colgroup>
      <thead>
        <tr>
          <th className="q-sr-caption" colSpan={3}>
            {title}
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const mark = checklist[item.key];

          return (
            <tr key={item.key}>
              {/*
               * A question with nothing to describe takes the whole width, as
               * the original's Panel Inspection table does. Not a saving of
               * ink but of *height*: penned into a third of the sheet, "Panel
               * and surrounding equipment, conduit and wiring well secured and
               * in good condition?" wraps to three lines, and seven questions
               * doing that is most of a page on their own.
               */}
              {item.description ? (
                <>
                  <td className="q-sr-check-label">{item.label}</td>
                  <td className="q-sr-check-detail">{item.description}</td>
                </>
              ) : (
                <td colSpan={2}>{item.label}</td>
              )}
              <td className="q-sr-tick">{mark ? MARK_GLYPH[mark] : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * "Action Taken / Findings". The two columns are independent — the sheet uses a
 * left-hand-only row as an area heading and a right-hand-only row to hang a
 * defect under it — so each cell is printed as given, and only the severity
 * changes how a finding is set.
 */
function FindingsTable({ lines }: { lines: ServiceReportRecord["lines"] }) {
  if (lines.length === 0) return null;

  return (
    <table className="q-sr-table q-sr-findings">
      <thead>
        <tr>
          <th className="q-sr-caption">Action Taken</th>
          <th className="q-sr-caption">Findings</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line, index) => (
          <tr key={index}>
            <td>{line.action}</td>
            {/*
             * Red for a defect, as the original writes them. Colour is not the
             * only carrier: a defect is the only thing that appears in this
             * column beneath an area heading, and the recommendations below
             * restate what has to be done about it.
             */}
            <td className={line.severity === "defect" ? "q-sr-defect" : undefined}>
              {line.finding}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * The scan, drawn at its own aspect ratio so it is never squashed, and pulled
 * down so its strokes cross into the name beneath as a wet signature would.
 */
function SignatureScan({ signature }: { signature: BrandImage }) {
  // Convert the printed width to px at 96dpi for next/image.
  const widthPx = Math.round((SIGNATURE_WIDTH_MM / 25.4) * 96);
  const heightPx = Math.round(widthPx * (signature.height / signature.width));

  return (
    <Image
      src={signature.src}
      alt=""
      width={widthPx}
      height={heightPx}
      // Decorative: the signatory's name is printed directly beneath.
      aria-hidden="true"
      className="q-sig-image"
    />
  );
}
