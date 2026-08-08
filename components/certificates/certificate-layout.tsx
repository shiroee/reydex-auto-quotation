import Image from "next/image";

import type { Certificate, CompanyProfile } from "@/db";
import type { BrandImage } from "@/lib/brand";
import { formatLongDateUpper, issuedOn } from "@/lib/certificates/format";

/** Printed width of the signature scan, as on a quotation. */
const SIGNATURE_WIDTH_MM = 34;

/**
 * The certificate of completion, laid out as the original Word document.
 *
 * The wording is here rather than in the database: every certificate says the
 * same four things, and the record supplies only the blanks. That is what
 * "fixed template" buys — a change of wording is one edit to this file and every
 * certificate, printed and future, reads the same way.
 *
 * It is also the constraint worth knowing: this certifies *preventive
 * maintenance, inspection and testing*. A certificate for an installation or a
 * supply-only job would need a second template beside this one.
 */
export function CertificateLayout({
  certificate,
  profile,
  signature,
}: {
  certificate: Certificate;
  profile: CompanyProfile | undefined;
  signature: BrandImage | null;
}) {
  const companyName = profile?.name ?? "REYDEX FIRE EXTINGUISHER TRADING";

  /*
   * Both parties fall back to the client. The mall operator that inspects a
   * branch's works is usually — but not always — the client named above, and a
   * blank field should print the sensible thing rather than a hole.
   */
  const inspector = certificate.inspectedBy?.trim() || certificate.clientName;
  const accepting = certificate.acceptedBy?.trim() || certificate.clientName;

  const signatoryName =
    certificate.signatoryName?.trim() || profile?.signatoryName || "";
  const signatoryTitle =
    certificate.signatoryTitle?.trim() || profile?.signatoryTitle || "";

  const issued = issuedOn(certificate.issueDate);

  return (
    <div className="q-cert">
      <h1 className="q-cert-title">CERTIFICATE OF COMPLETION</h1>

      <table className="q-cert-particulars">
        <tbody>
          <tr>
            <th scope="row">PROJECT</th>
            <td className="q-cert-colon">:</td>
            <td className="q-cert-value">{certificate.projectTitle}</td>
          </tr>
          <tr>
            <th scope="row">CLIENT</th>
            <td className="q-cert-colon">:</td>
            <td className="q-cert-value">{certificate.clientName}</td>
          </tr>
        </tbody>
      </table>

      <div className="q-cert-body">
        <p>
          This is to certify that{" "}
          <span className="q-strong">{companyName}</span> has successfully
          completed the preventive maintenance, inspection, and testing of the{" "}
          <span className="q-strong">{certificate.projectTitle}</span> at{" "}
          <span className="q-strong">{certificate.clientName}</span>, located at{" "}
          <span className="q-strong">{certificate.location}</span>, on{" "}
          <span className="q-strong">
            {formatLongDateUpper(certificate.completionDate)}
          </span>
          .
        </p>

        <p>
          The above-mentioned fire protection systems were inspected and found to
          be completed in accordance with applicable standards and requirements.
        </p>

        <p>
          {inspector} has inspected the works undertaken and considers the same
          satisfactory and acceptable, and hereby issues this Certificate of
          Completion as confirmation thereof.
        </p>

        <p>
          This certification is hereby issued in full compliance with the
          requirements of the Bureau of Fire Protection.
        </p>

        {/*
         * Dropped rather than printed broken when the date is unusable — the
         * column is `not null`, so this only fires on data written outside the
         * form.
         */}
        {issued ? (
          <p>
            Issued this{" "}
            <span className="q-strong">
              {issued.day}
              <sup>{issued.suffix.toUpperCase()}</sup>
            </span>{" "}
            day of <span className="q-strong">{issued.monthYear}</span> at{" "}
            <span className="q-strong">{certificate.issuePlace}</span>.
          </p>
        ) : null}
      </div>

      <div className="q-cert-signature">
        <p className="q-cert-sig-label">CERTIFIED BY:</p>
        <SignatureRule
          signature={signature}
          name={signatoryName}
          title={signatoryTitle}
        />
      </div>

      {/*
       * No scan on the accepting side: it is signed by the client, by hand, on
       * the printed sheet. The empty band is the room to do that in.
       */}
      <div className="q-cert-signature q-cert-signature-accepting">
        <p className="q-cert-sig-label">APPROVED &amp; ACCEPTED BY:</p>
        <SignatureRule signature={null} name={accepting} />
      </div>
    </div>
  );
}

/**
 * A signature band over a name rule. The scan is pulled down so its strokes
 * cross the rule, as a wet signature would; with no scan the band stays empty
 * and leaves room to sign by hand.
 */
function SignatureRule({
  signature,
  name,
  title,
}: {
  signature: BrandImage | null;
  name: string;
  title?: string;
}) {
  // Derive the drawn height from the scan's own aspect ratio so it is never
  // squashed, and convert to px at 96dpi for next/image.
  const widthPx = Math.round((SIGNATURE_WIDTH_MM / 25.4) * 96);
  const heightPx = signature
    ? Math.round(widthPx * (signature.height / signature.width))
    : 0;

  return (
    <>
      <div className="q-sig-mark">
        {signature ? (
          <Image
            src={signature.src}
            alt=""
            width={widthPx}
            height={heightPx}
            // Decorative: the signatory's name is printed directly beneath.
            aria-hidden="true"
            className="ml-8 q-sig-image"
          />
        ) : null}
      </div>

      <div className="q-sig-name">
        <p>{name}</p>
        {title ? <p className="q-sig-title">{title}</p> : null}
      </div>
    </>
  );
}
