import Image from "next/image";

import type { Certificate, CompanyProfile } from "@/db";
import type { BrandImage } from "@/lib/brand";
import { formatLongDate, issuedOn } from "@/lib/certificates/format";

/** Printed width of the signature scan, as on the completion certificate. */
const SIGNATURE_WIDTH_MM = 34;

/**
 * The certification of safety and reliability of a fire protection system, laid
 * out as the original Word document.
 *
 * This is the second of the two certificates, and it differs from the first in
 * more than its wording. A certificate of completion is a *company* saying it
 * finished a job; this is a *person* — a Registered Mechanical Engineer, named
 * with their PRC registration — saying they inspected a system and found it fit
 * to operate. Hence the first-person paragraph, the single signature block, and
 * the licence lines under the name: the Bureau of Fire Protection reads the
 * registration number off this sheet.
 *
 * As with the completion certificate, the wording is here rather than in the
 * database. The record supplies the establishment, the system, the two dates,
 * the place of issue and the findings clause; everything else is fixed, so a
 * change of wording is one edit to this file.
 */
export function SafetyCertificateLayout({
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
   * The office address is quoted in the body, so a blank profile would leave the
   * sentence hanging on "located at .". Dropping the clause keeps it a sentence.
   */
  const mainAddress = profile?.mainAddress?.trim() || null;

  const signatoryName =
    certificate.signatoryName?.trim() || profile?.signatoryName || "";
  const signatoryTitle =
    certificate.signatoryTitle?.trim() || profile?.signatoryTitle || "";

  const issued = issuedOn(certificate.issueDate);
  const tested = formatLongDate(certificate.completionDate);

  return (
    <div className="q-cert">
      <h1 className="q-cert-title q-cert-title-ruled">
        {/*
         * The original letter-spaces the first word by hand — "C E R T I F I C
         * A T I O N" — which is a Word habit rather than a meaning. Tracking it
         * in CSS keeps the look and keeps the text one selectable, searchable
         * word, so a reader copying the title out of a PDF gets the word back.
         */}
        <span className="q-cert-title-tracked">Certification</span> of Safety
        &amp; Reliability of Fire Protection System
      </h1>

      <div className="q-cert-subject">
        <p className="q-cert-subject-name">{certificate.clientName}</p>
        <p className="q-cert-subject-location">{certificate.location}</p>
      </div>

      <div className="q-cert-body q-cert-body-airy">
        <p>
          This is to certify that the{" "}
          <span className="q-strong">{certificate.projectTitle}</span> in
          above-mentioned establishment is functional and safe to operate during
          the testing and maintenance conducted on {tested}.
        </p>

        <p>
          The Fire Protection equipment was tested and maintained by the
          technical personnel duly supervised by an engineer of{" "}
          <span className="q-strong">{companyName}</span>
          {mainAddress ? <> with main office located at {mainAddress}</> : null}.
        </p>

        <p>
          I hereby certify that I have inspected and observed the operation of
          the Fire Protection Systems of{" "}
          <span className="q-strong">{certificate.clientName}</span> on {tested}{" "}
          and the system is working normally and within its standard operating
          parameters
          {certificate.findings === "minor"
            ? " but with minor findings to consider"
            : ""}
          .
        </p>

        <p>
          This Certification is being issued in compliance with the requirement
          of Bureau of Fire Protection.
        </p>

        {/*
         * Dropped rather than printed broken when the date is unusable — the
         * column is `not null`, so this only fires on data written outside the
         * form. Same handling as the completion certificate.
         */}
        {issued ? (
          <p>
            Issued this {issued.day}
            <sup>{issued.suffix}</sup> day of {issued.monthYear} at{" "}
            {certificate.issuePlace}.
          </p>
        ) : null}
      </div>

      {/*
       * One signature block, not two: nobody countersigns this. The engineer
       * certifies, and the sheet goes to the client's fire-safety file as it is.
       */}
      <div className="q-cert-signature">
        <p className="q-cert-sig-label">CERTIFIED BY:</p>

        <div className="q-sig-mark q-cert-sig-scan">
          {signature ? <SignatureScan signature={signature} /> : null}
        </div>

        <div className="q-cert-credentials">
          <p className="q-cert-credential-name">{signatoryName}</p>
          {signatoryTitle ? (
            <p className="q-cert-credential-title">{signatoryTitle}</p>
          ) : null}
          {certificate.engineerLicenseNo ? (
            <p>PRC Registration # {certificate.engineerLicenseNo}</p>
          ) : null}
          {certificate.engineerLicenseExpiry ? (
            <p>
              Validity Date: {formatLongDate(certificate.engineerLicenseExpiry)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
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
