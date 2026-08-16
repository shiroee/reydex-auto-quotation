import { formatLongDateUpper } from "@/lib/certificates/format";
import type {
  ServiceReportPlateView,
  ServiceReportRecord,
} from "@/lib/service-reports/service";

/**
 * The PM Service Report: what was found, what was done, what is recommended, and
 * the site photographs that evidence all three.
 *
 * The second of the two documents raised after a maintenance visit, and the
 * opposite of the checklist in shape. That one is a ruled form scored against
 * fixed questions; this is prose written per visit, so almost nothing here is
 * fixed wording — the three section headings and the letterhead are the whole of
 * it, and everything else comes off the record.
 *
 * Multi-page by nature rather than by accident: the sample runs to four sheets,
 * three of them plates. The repeating-letterhead frame the print route wraps
 * this in is what makes that work, and each plate carries `break-inside: avoid`
 * so a caption never lands on a different page from the photographs it names.
 */
export function PhotoReportLayout({ report }: { report: ServiceReportRecord }) {
  return (
    <div className="q-pr">
      <dl className="q-pr-particulars">
        <Particular label="CLIENT" value={report.customerName} />
        <Particular label="ADDRESS" value={report.address} />
        <Particular label="SUBJECT" value={report.projectTitle} />
        <Particular
          label="DATE"
          value={formatLongDateUpper(report.serviceDate)}
        />
      </dl>

      {/*
       * The lead plate sits above the prose on the original — a photograph of
       * the panel as found, which the findings below then describe. Every other
       * plate follows the three sections.
       */}
      {report.plates.length > 0 ? <Plate plate={report.plates[0]} /> : null}

      <Bullets title="FINDINGS:" items={report.findings} />
      <Bullets title="ACTIVITIES DONE:" items={report.activities} />
      <Bullets title="RECOMMENDATION(S):" items={report.recommendations} />

      {report.plates.slice(1).map((plate) => (
        <Plate key={plate.id} plate={plate} />
      ))}
    </div>
  );
}

function Particular({ label, value }: { label: string; value: string }) {
  return (
    <div className="q-pr-particular">
      <dt>{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * One of the three prose sections. Dropped entirely when empty rather than
 * printed as a heading over nothing — a visit with no findings is a result, and
 * an empty ruled box reads as a form somebody failed to fill in.
 */
function Bullets({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <section className="q-pr-section">
      <h2 className="q-pr-section-title">{title}</h2>
      <ul className="q-pr-list">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A group of photographs under one caption.
 *
 * The column count follows the photograph count, as the original does: the lone
 * "existing condition" shot is printed large and centred, a pair sits two-up,
 * and anything more runs three to a row. Past three the grid wraps rather than
 * shrinking further — nine photographs three-up is what the source sheets show.
 */
function Plate({ plate }: { plate: ServiceReportPlateView }) {
  if (plate.photos.length === 0) return null;

  const columns = Math.min(plate.photos.length, 3);

  return (
    <figure className="q-pr-plate">
      <div className={`q-pr-grid q-pr-grid-${columns}`}>
        {plate.photos.map((src) => (
          /*
           * A plain `img`, not `next/image`. These are static files under
           * `public/`, already downscaled to their printed size, and the
           * optimiser would only re-encode them a second time. `loading="eager"`
           * because a lazily-loaded image is a blank box in a print — the print
           * job does not wait for the viewport to reach it.
           */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            loading="eager"
            className="q-pr-photo"
          />
        ))}
      </div>

      {plate.caption ? (
        <figcaption className="q-pr-caption">{plate.caption}</figcaption>
      ) : null}
    </figure>
  );
}
